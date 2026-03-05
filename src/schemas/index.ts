import z from "zod";

import { WeekDay } from "../generated/prisma/enums.js";

export const ErrorSchema = z.object({
  error: z.string(),
  code: z.string(),
});

export const workoutPlanSchema = z.object({
  name: z.string().trim().min(1),
  coverImageUrl: z.string().url().nullish(),
  workoutDays: z.array(
    z.object({
      name: z.string().trim().min(1),
      weekDay: z.nativeEnum(WeekDay),
      isRest: z.boolean().default(false),
      coverImageUrl: z.string().url().nullish(),
      estimatedDurationInSeconds: z.number().min(1),
      exercises: z.array(
        z.object({
          order: z.number().min(0),
          name: z.string().trim().min(1),
          sets: z.number().min(1),
          reps: z.number().min(1),
          restTimeInSeconds: z.number().min(1),
        }),
      ),
    }),
  ),
});

export const startWorkoutSessionSchema = z.object({
  workoutSessionId: z.string().uuid(),
});

export const updateWorkoutSessionSchema = z.object({
  id: z.string().uuid(),
  completedAt: z.string().datetime(),
  startedAt: z.string().datetime(),
});

export const homeDataSchema = z.object({
  activeWorkoutPlanId: z.string().uuid(),
  todayWorkoutDay: z.object({
    workoutPlanId: z.string().uuid(),
    id: z.string().uuid(),
    name: z.string(),
    isRest: z.boolean(),
    weekDay: z.nativeEnum(WeekDay),
    estimatedDurationInSeconds: z.number(),
    coverImageUrl: z.string().url().nullish(),
    exercisesCount: z.number(),
  }),
  workoutStreak: z.number(),
  consistencyByDay: z.record(
    z.string(),
    z.object({
      workoutDayCompleted: z.boolean(),
      workoutDayStarted: z.boolean(),
    }),
  ),
});
