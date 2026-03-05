import { prisma } from "../lib/db.js";

export interface InputDto {
  userId: string;
  workoutPlanId: string;
  workoutDayId: string;
}

export interface OutputDto {
  workoutSessionId: string;
}

export class WorkoutPlanNotActiveError extends Error {
  constructor() {
    super("Workout plan is not active");
    this.name = "WorkoutPlanNotActiveError";
  }
}

export class WorkoutSessionAlreadyStartedError extends Error {
  constructor() {
    super("Workout session already started for this day");
    this.name = "WorkoutSessionAlreadyStartedError";
  }
}

export class StartWorkoutSession {
  async execute(dto: InputDto): Promise<OutputDto> {
    const workoutPlan = await prisma.workoutPlan.findUnique({
      where: { id: dto.workoutPlanId },
      include: {
        workoutDays: {
          include: {
            sessions: true,
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

    if (!workoutPlan.isActive) {
      throw new WorkoutPlanNotActiveError();
    }

    const workoutDay = workoutPlan.workoutDays.find(
      (day) => day.id === dto.workoutDayId,
    );

    if (!workoutDay) {
      throw new Error("Workout day not found");
    }

    const hasActiveSession = workoutDay.sessions.some(
      (session) => session.startedAt && !session.completedAt,
    );

    if (hasActiveSession) {
      throw new WorkoutSessionAlreadyStartedError();
    }

    const workoutSession = await prisma.workoutSession.create({
      data: {
        id: crypto.randomUUID(),
        workoutDayId: workoutDay.id,
        startedAt: new Date(),
      },
    });

    return {
      workoutSessionId: workoutSession.id,
    };
  }
}
