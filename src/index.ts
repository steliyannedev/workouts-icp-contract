import {
    ic,
    nat64,
    $query,
    Record,
    Result,
    StableBTreeMap,
    $update,
    Variant,
    Vec,
    match
} from 'azle';
import { v4 as uuidv4 } from "uuid";

// Define possible errors
type Errors = Variant<{
    WorkoutDoesNotExist: string,
    UserDoesNotExist: string,
    MuscleGroupDoesNotExist: string
}>;

// Define types for User and WorkoutSession
type User = Record<{
    id: string,
    createdAt: nat64,
    sessionIds: Vec<string>,
    name: string
}>;

type WorkoutSession = Record<{
    id: string,
    userId: string,
    startedAt: nat64,
    finishedAt: nat64,
    calories: nat64,
    muscleGroup: string
}>;

// List of possible muscle groups
const POSSIBLE_GROUPS: Vec<string> = ["shoulders", "back", "chest", "legs", "cardio"];

// Map to store users and workouts
const users = new StableBTreeMap<string, User>(0, 44, 1024);
const workouts = new StableBTreeMap<string, WorkoutSession>(1, 44, 1024);

// Create a new user
$update
export function createUser(name: string): Result<User, string> {
    try {
        const id = uuidv4();
        const user: User = {
            id,
            createdAt: ic.time(),
            sessionIds: [],
            name,
        };
        users.insert(user.id, user);
        return Result.Ok<User, string>(user);
    } catch (error: any) {
        return Result.Err<User, string>(`Error creating user: ${error}`);
    }
}

// Get user by ID
$query
export function getUserById(id: string): Result<User, string> {
    try {
        if (!id || typeof id !== "string") {
            throw new Error("Invalid user ID");
        }

        return match(users.get(id), {
            Some: (user) => Result.Ok<User, string>(user),
            None: () => Result.Err<User, string>("User does not exist"),
        });
    } catch (error: any) {
        return Result.Err<User, string>(`Error getting user: ${error}`);
    }
}

// Get all users
$query
export function getAllUsers(): Result<Vec<User>, string> {
    try {
        return Result.Ok<Vec<User>, string>(users.values());
    } catch (error: any) {
        return Result.Err<Vec<User>, string>(`Error getting all users: ${error}`);
    }
}

// Delete a user
$update
export function deleteUser(id: string): Result<User, string> {
    try {
        if (!id || typeof id !== "string") {
            throw new Error("Invalid user ID");
        }

        const userOpt = users.get(id);

        return match(userOpt, {
            Some: (user) => {
                user.sessionIds.forEach((sessionId: string) => {
                    workouts.remove(sessionId);
                });
                users.remove(user.id);
                return Result.Ok<User, string>(user);
            },
            None: () => Result.Err<User, string>("User does not exist"),
        });
    } catch (error: any) {
        return Result.Err<User, string>(`Error deleting user: ${error}`);
    }
}

// Start a workout
$update
export function startWorkout(group: string, userId: string): Result<WorkoutSession, Errors> {
    try {
        // Validate ids 

        if (!userId || typeof userId !== "string") {
            throw new Error("Invalid user ID");
        }

        if (!group || typeof group !== "string") {
            throw new Error("Invalid group");
        }


        if (!POSSIBLE_GROUPS.includes(group.toLowerCase())) {
            return Result.Err<WorkoutSession, Errors>({ MuscleGroupDoesNotExist: `'${group}' is not a viable group, please select one of: ${POSSIBLE_GROUPS}` });
        } else {
            const id = uuidv4();
            const workout: WorkoutSession = {
                id,
                userId: userId, // Use the provided userId instead of id
                startedAt: ic.time(),
                finishedAt: 0n,
                calories: 0n,
                muscleGroup: group
            };
            workouts.insert(workout.id, workout);

            const userOpt = users.get(userId); // Use userId here

            return match(userOpt, {
                Some: (user) => {
                    const updatedUser: User = {
                        ...user,
                        sessionIds: [...user.sessionIds, workout.id]
                    };
                    users.insert(updatedUser.id, updatedUser);
                    return Result.Ok<WorkoutSession, Errors>(workout);
                },
                None: () => Result.Err<WorkoutSession, Errors>({ UserDoesNotExist: "invalid user ID" }),
            });
        }
    } catch (error: any) {
        return Result.Err<WorkoutSession, Errors>({ UserDoesNotExist: "invalid user ID" })
    }
}

// End a workout
$update
export function endWorkout(id: string, calories: nat64): Result<WorkoutSession, string> {
    try {
        // Validate ids 
        
        if (!id || typeof id !== "string") {
            throw new Error("Invalid user ID");
        }

        if (calories <= 0) {
            throw new Error("Invalid calories");
        }

        return match(workouts.get(id), {
            Some: (workout) => {
                const updatedWorkout: WorkoutSession = {
                    ...workout,
                    finishedAt: ic.time(),
                    calories
                };

                workouts.insert(workout.id, updatedWorkout);
                return Result.Ok<WorkoutSession, string>(updatedWorkout);
            },
            None: () => Result.Err<WorkoutSession, string>("User does not exist"),
        });
    } catch (error: any) {
        return Result.Err<WorkoutSession, string>(`Error ending workout: ${error}`);
    }
}

// List all workouts
$query
export function listWorkouts(): Result<Vec<WorkoutSession>, string> {
    try {
        return Result.Ok<Vec<WorkoutSession>, string>(workouts.values());
    } catch (error: any) {
        return Result.Err<Vec<WorkoutSession>, string>(`Error listing workouts: ${error}`);
    }
}

// Crypto workaround
globalThis.crypto = {
    //@ts-ignore
    getRandomValues: () => {
        let array = new Uint8Array(32);

        for (let i = 0; i < array.length; i++) {
            array[i] = Math.floor(Math.random() * 256);
        }

        return array;
    },
};
