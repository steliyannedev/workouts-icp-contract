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

const POSSIBLE_GROUPS = ["shouders", "back", "chest", "legs", "cardio"];

const User = Record({
    id: Principal,
    createdAt: nat64,
    sessionIds: Vec(Principal),
    name: text
});

const WorkoutSession = Record({
    id: Principal,
    userId: Principal,
    startedAt: nat64,
    finishedAt: nat64,
    calories: nat64,
    muscleGroup: text
});

const Errors = Variant({
    WorkoutDoesNotExist: Principal,
    UserDoesNotExist: Principal,
    MuscleGroupDoesNotExist: text
});

let users = StableBTreeMap(Principal, User, 0);
let workouts = StableBTreeMap(Principal, WorkoutSession, 1);

export default Canister({
    /**
     * Creates a new user.
     * @param name - Name for the user.
     * @returns the newly created user instance.
    */
    createUser: update([text], User, (name) => {
        const id = ic.caller();
        const user: typeof User = {
            id,
            createdAt: ic.time(),
            sessionIds: [],
            name
        }
        users.insert(user.id, user)

        return user
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
    deleteUser: update([Principal], Result(User, Errors), (id) => {
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
        if (!POSSIBLE_GROUPS.includes(group.toLowerCase())) {
            return Err({MuscleGroupDoesNotExist: `'${group}' is not a viable group, please select one of: ${POSSIBLE_GROUPS}`})
        }
        const id = generateId();
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
    endWorkout: update([Principal, nat64], Result(WorkoutSession, Errors), (id, calories) => {
        if (!workouts.containsKey(id)) {
            return Err({WorkoutDoesNotExist: id})
        }
        const workout = workouts.get(id).Some;
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

/**
 * Generate an ID of a type Principal.
 * @returns a Principal ID.
*/
function generateId(): Principal {
    const randomBytes = new Array(29)
        .fill(0)
        .map((_) => Math.floor(Math.random() * 256));

    return Principal.fromUint8Array(Uint8Array.from(randomBytes));
}