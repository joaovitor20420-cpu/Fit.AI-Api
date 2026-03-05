import { WeekDay } from "../generated/prisma/enums.js";
import { prisma } from "../lib/db.js";

export interface InputDto {
  userId: string;
  active?: boolean;
}

export interface OutputDto {
  workoutPlans: Array<{
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
  }>;
}

export class ListWorkoutPlans {
  async execute(dto: InputDto): Promise<OutputDto> {
    const workoutPlans = await prisma.workoutPlan.findMany({
      where: {
        userId: dto.userId,
        ...(dto.active !== undefined ? { isActive: dto.active } : {}),
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
      orderBy: {
        createdAt: "desc",
      },
    });

    return {
      workoutPlans: workoutPlans.map((plan) => ({
        id: plan.id,
        name: plan.name,
        coverImageUrl: plan.coverImageUrl,
        workoutDays: plan.workoutDays.map((day) => ({
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
      })),
    };
  }
}

