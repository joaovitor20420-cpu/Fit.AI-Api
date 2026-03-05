import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";

import { WeekDay } from "../generated/prisma/enums.js";
import { prisma } from "../lib/db.js";

dayjs.extend(utc);

export interface InputDto {
  userId: string;
  workoutPlanId: string;
  workoutDayId: string;
}

export interface OutputDto {
  id: string;
  name: string;
  isRest: boolean;
  coverImageUrl?: string | null;
  estimatedDurationInSeconds: number;
  weekDay: WeekDay;
  exercises: Array<{
    id: string;
    order: number;
    name: string;
    sets: number;
    reps: number;
    restTimeInSeconds: number;
    workoutDayId: string;
  }>;
  sessions: Array<{
    id: string;
    workoutDayId: string;
    startedAt?: string | null;
    completedAt?: string | null;
  }>;
}

export class GetWorkoutDay {
  async execute(dto: InputDto): Promise<OutputDto> {
    const workoutPlan = await prisma.workoutPlan.findUnique({
      where: { id: dto.workoutPlanId },
    });

    if (!workoutPlan) {
      throw new Error("Workout plan not found");
    }

    if (workoutPlan.userId !== dto.userId) {
      throw new Error("Forbidden");
    }

    const workoutDay = await prisma.workoutDay.findUnique({
      where: { id: dto.workoutDayId },
      include: {
        workoutExercises: {
          orderBy: { order: "asc" },
        },
        sessions: true,
      },
    });

    if (!workoutDay || workoutDay.workoutPlanId !== dto.workoutPlanId) {
      throw new Error("Workout day not found");
    }

    return {
      id: workoutDay.id,
      name: workoutDay.name,
      isRest: workoutDay.isRest,
      coverImageUrl: workoutDay.coverImageUrl,
      estimatedDurationInSeconds: workoutDay.estimatedDurationSeconds,
      weekDay: workoutDay.weekDay,
      exercises: workoutDay.workoutExercises.map((ex) => ({
        id: ex.id,
        order: ex.order,
        name: ex.name,
        sets: ex.sets,
        reps: ex.reps,
        restTimeInSeconds: ex.restTimeInSeconds,
        workoutDayId: ex.workoutDayId,
      })),
      sessions: workoutDay.sessions.map((s) => ({
        id: s.id,
        workoutDayId: s.workoutDayId,
        startedAt: s.startedAt
          ? dayjs.utc(s.startedAt).format("YYYY-MM-DD")
          : null,
        completedAt: s.completedAt
          ? dayjs.utc(s.completedAt).format("YYYY-MM-DD")
          : null,
      })),
    };
  }
}
