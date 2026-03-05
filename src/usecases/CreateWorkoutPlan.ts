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
    coverImageUrl?: string;
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
    const existingWorkoutPlan = await prisma.workoutPlan.findFirst({
      where: {
        isActive: true,
      },
    });
    return prisma.$transaction(async (tx) => {
      if (existingWorkoutPlan) {
        await tx.workoutPlan.update({
          where: {
            id: existingWorkoutPlan.id,
          },
          data: {
            isActive: false,
          },
        });
      }
      const createdPlan = await tx.workoutPlan.create({
        data: {
          id: crypto.randomUUID(),
          name: dto.name,
          coverImageUrl: dto.coverImageUrl,
          userId: dto.userId,
          isActive: true,
          workoutDays: {
            create: dto.workoutDays.map((workoutDay) => ({
              id: crypto.randomUUID(),
              name: workoutDay.name,
              weekDay: workoutDay.weekDay,
              isRest: workoutDay.isRest,
              coverImageUrl: workoutDay.coverImageUrl,
              estimatedDurationSeconds: workoutDay.estimatedDurationInSeconds,
              workoutExercises: {
                create: workoutDay.exercises.map((exercise) => ({
                  id: crypto.randomUUID(),
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
      });
      const plan = await tx.workoutPlan.findUnique({
        where: { id: createdPlan.id },
        include: {
          workoutDays: {
            include: {
              workoutExercises: true,
            },
          },
        },
      });

      if (!plan) {
        throw new Error("Workout plan not found");
      }
      return {
        id: plan.id,
        name: plan.name,
        coverImageUrl: plan.coverImageUrl,
        workoutDays: plan.workoutDays.map((day) => ({
          name: day.name,
          weekDay: day.weekDay,
          isRest: day.isRest,
          coverImageUrl: day.coverImageUrl,
          estimatedDurationInSeconds: day.estimatedDurationSeconds,
          exercises: day.workoutExercises.map((ex) => ({
            order: ex.order,
            name: ex.name,
            sets: ex.sets,
            reps: ex.reps,
            restTimeInSeconds: ex.restTimeInSeconds,
          })),
        })),
      };
    });
  }
}
