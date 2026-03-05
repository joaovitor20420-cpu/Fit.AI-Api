import { WeekDay } from "../generated/prisma/enums.js";
import { prisma } from "../lib/db.js";

export interface InputDto {
  userId: string;
  name: string;
  coverImageUrl?: string;
  workoutDays: Array<{
    name: string;
    weekDay: WeekDay;
    isRest: boolean;
    estimatedDurationInSeconds: number;
    coverImageUrl?: string;
    exercises: Array<{
      order: number;
      name: string;
      sets: number;
      reps: number;
      restTimeInSeconds: number;
    }>;
  }>;
}

export interface OutputDto {
  id: string;
  name: string;
  coverImageUrl?: string | null;
  workoutDays: Array<{
    name: string;
    weekDay: WeekDay;
    isRest: boolean;
    coverImageUrl?: string | null;
    estimatedDurationInSeconds: number;
    exercises: Array<{
      order: number;
      name: string;
      sets: number;
      reps: number;
      restTimeInSeconds: number;
    }>;
  }>;
}

export class CreateWorkoutPlan {
  async execute(dto: InputDto): Promise<OutputDto> {
    const workoutPlan = await prisma.workoutPlan.create({
      data: {
        name: dto.name,
        coverImageUrl: dto.coverImageUrl,
        userId: dto.userId,
        workoutDays: {
          create: dto.workoutDays.map((day) => ({
            name: day.name,
            weekDay: day.weekDay,
            isRest: day.isRest,
            estimatedDurationSeconds: day.estimatedDurationInSeconds,
            coverImageUrl: day.coverImageUrl,
            workoutExercises: {
              create: day.exercises.map((exercise) => ({
                order: exercise.order,
                name: exercise.name,
                sets: exercise.sets,
                reps: exercise.reps,
                restTimeInSeconds: exercise.restTimeInSeconds,
              })),
            },
          })),
        },
      },
      include: {
        workoutDays: {
          include: {
            workoutExercises: true,
          },
          orderBy: {
            weekDay: "asc",
          },
        },
      },
    });

    return {
      id: workoutPlan.id,
      name: workoutPlan.name,
      coverImageUrl: workoutPlan.coverImageUrl,
      workoutDays: workoutPlan.workoutDays.map((day) => ({
        name: day.name,
        weekDay: day.weekDay,
        isRest: day.isRest,
        coverImageUrl: day.coverImageUrl,
        estimatedDurationInSeconds: day.estimatedDurationSeconds,
        exercises: day.workoutExercises.map((exercise) => ({
          order: exercise.order,
          name: exercise.name,
          sets: exercise.sets,
          reps: exercise.reps,
          restTimeInSeconds: exercise.restTimeInSeconds,
        })),
      })),
    };
  }
}
