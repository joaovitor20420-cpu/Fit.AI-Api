import { prisma } from "../lib/db.js";

export interface InputDto {
  userId: string;
  workoutPlanId: string;
  workoutDayId: string;
  workoutSessionId: string;
  completedAt: string;
}

export interface OutputDto {
  id: string;
  completedAt: string;
  startedAt: string;
}

export class UpdateWorkoutSession {
  async execute(dto: InputDto): Promise<OutputDto> {
    const workoutPlan = await prisma.workoutPlan.findUnique({
      where: { id: dto.workoutPlanId },
      include: {
        workoutDays: {
          where: { id: dto.workoutDayId },
          include: {
            sessions: {
              where: { id: dto.workoutSessionId },
            },
          },
        },
      },
    });

    if (!workoutPlan) {
      throw new Error("Workout plan not found");
    }

    if (workoutPlan.userId !== dto.userId) {
      throw new Error("Forbidden");
    }

    const workoutDay = workoutPlan.workoutDays[0];
    if (!workoutDay) {
      throw new Error("Workout day not found");
    }

    const workoutSession = workoutDay.sessions[0];
    if (!workoutSession) {
      throw new Error("Workout session not found");
    }

    const updatedSession = await prisma.workoutSession.update({
      where: { id: workoutSession.id },
      data: {
        completedAt: new Date(dto.completedAt),
      },
    });

    return {
      id: updatedSession.id,
      completedAt: updatedSession.completedAt!.toISOString(),
      startedAt: updatedSession.startedAt.toISOString(),
    };
  }
}
