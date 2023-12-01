import {
    Canister,
    ic,
    Err,
    nat64,
    Ok,
    Principal,
    query,
    Record,
    Result,
    StableBTreeMap,
    text,
    update,
    Variant,
    Vec
} from 'azle';

import { v4 as uuidv4 } from 'uuid'

const POSSIBLE_GROUPS = ["shouders", "back", "chest", "legs", "cardio"];

const User = Record({
    id: Principal,
    createdAt: nat64,
    sessionIds: Vec(text),
    name: text
});

const WorkoutSession = Record({
    id: text,
    userId: Principal,
    startedAt: nat64,
    finishedAt: nat64,
    calories: nat64,
    muscleGroup: text
});

const Errors = Variant({
    WorkoutDoesNotExist: text,
    UserDoesNotExist: Principal,
    UserDoesExist: Principal,
    MuscleGroupDoesNotExist: text,
    AuthenticationFail: Principal,
    InvalidPayload: text
});

let users = StableBTreeMap(Principal, User, 0);
let workouts = StableBTreeMap(text, WorkoutSession, 1);

const isInvalidString = (str : text) => str.trim().length == 0

export default Canister({
    /**
     * Creates a new user.
     * @param name - Name for the user.
     * @returns the newly created user instance.
    */
    createUser: update([text], Result(User, Errors), (name) => {
        const id = ic.caller();
        if (users.containsKey(id)){
            return Err({UserDoesExist: id})
        }
        if (isInvalidString(name)){
            return Err({InvalidPayload: name})
        }
        const user: typeof User = {
            id,
            createdAt: ic.time(),
            sessionIds: [],
            name
        }
        users.insert(user.id, user)

        return Ok(user)
    }),
    /**
     * Fetch user by id.
     * @param id - ID of the user.
     * @returns a user instance if exists or an error if user doesn't exists.
    */
    getUserById: query([Principal], Result(User, Errors), (id) => {
        if (!users.containsKey(id)) {
            return Err({UserDoesNotExist: id})
        }
        const user = users.get(id).Some;

        return Ok(user);
    }),
    /**
     * Fetch all users.
     * @returns a list of all users.
    */
    getAllUsers: query([], Vec(User), () => {
        return users.values();
    }),
    /**
     * Delete a user by id.
     * @param id - ID of the user.
     * @returns the deleted instance of the user or an error msg if user id doesn't exists.
    */
    deleteUser: update([], Result(User, Errors), () => {
        const id = ic.caller();
        if (!users.containsKey(id)) {
            return Err({UserDoesNotExist: id})
        }
        const user = users.get(id).Some;
        user.sessionIds.forEach((sessionId: Principal) => {
            workouts.remove(sessionId)
        });
        users.remove(user.id);

        return Ok(user);
    }),
    /**
     * Create a workout and start it.
     * @param group - a string representation of a muscle group, available options - ["shouders", "back", "chest", "legs", "cardio"].
     * @returns an instance of a workout.
    */
    startWorkout: update([text], Result(WorkoutSession, Errors), (group) => {

        if (!users.containsKey(ic.caller())) {
            return Err({UserDoesNotExist: ic.caller()})
        }
        if (isInvalidString(group)){
            return Err({InvalidPayload: group})
        }
        if (!POSSIBLE_GROUPS.includes(group.toLowerCase())) {
            return Err({MuscleGroupDoesNotExist: `'${group}' is not a viable group, please select one of: ${POSSIBLE_GROUPS}`})
        }
        const id = uuidv4();
        const workout: typeof WorkoutSession = {
            id,
            userId: ic.caller(),
            startedAt: ic.time(),
            finishedAt: 0n,
            calories: 0n,
            muscleGroup: group
        };
        workouts.insert(workout.id, workout)
        const user = users.get(ic.caller()).Some
        const updatedUser: typeof User = {
            ...user,
            sessionIds: [...user.sessionIds, workout.id]
        };
        users.insert(updatedUser.id, updatedUser);

        return Ok(workout)
    }),
    /**
     * Create a workout and start it.
     * @param id - ID of a workout.
     * @param calories - an nat64 number.
     * @returns an instance of a workout or an error msg if workout doesn't exists.
    */
    endWorkout: update([text, nat64], Result(WorkoutSession, Errors), (id, calories) => {
        const caller = ic.caller();
        if (!users.containsKey(caller)) {
            return Err({UserDoesNotExist: caller})
        }
        if (!workouts.containsKey(id)) {
            return Err({WorkoutDoesNotExist: id})
        }
        const workout : typeof WorkoutSession = workouts.get(id).Some;

        if (workout.userId.toString() != caller.toString()){
            return Err({AuthenticationFail: caller})
        }
        const updatedWorkout: typeof WorkoutSession = {
            ...workout,
            finishedAt: ic.time(),
            calories
        }
        workouts.insert(workout.id, updatedWorkout);

        return Ok(updatedWorkout);
    }),
    /**
     * Fetch all workouts.
     * @returns a list of all workouts.
    */
    listWorkouts: query([], Vec(WorkoutSession), () => {
        return workouts.values();
    })

});

// a workaround to make uuid package work with Azle
globalThis.crypto = {
    // @ts-ignore
    getRandomValues: () => {
        let array = new Uint8Array(32);

        for (let i = 0; i < array.length; i++) {
            array[i] = Math.floor(Math.random() * 256);
        }

        return array;
    }
};

