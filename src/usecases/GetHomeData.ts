import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";

import { prisma } from "../lib/db.js";

dayjs.extend(utc);

const WEEKDAY_MAP: Record<number, string> = {
  0: "SUNDAY",
  1: "MONDAY",
  2: "TUESDAY",
  3: "WEDNESDAY",
  4: "THURSDAY",
  5: "FRIDAY",
  6: "SATURDAY",
};

export interface InputDto {
  userId: string;
  date: string;
}

export interface OutputDto {
  activeWorkoutPlanId: string;
  todayWorkoutDay: {
    workoutPlanId: string;
    id: string;
    name: string;
    isRest: boolean;
    weekDay: string;
    estimatedDurationInSeconds: number;
    coverImageUrl?: string | null;
    exercisesCount: number;
  };
  workoutStreak: number;
  consistencyByDay: Record<
    string,
    {
      workoutDayCompleted: boolean;
      workoutDayStarted: boolean;
    }
  >;
}

export class GetHomeData {
  async execute(dto: InputDto): Promise<OutputDto> {
    const currentDate = dayjs.utc(dto.date, "YYYY-MM-DD");
    const currentWeekDayName = WEEKDAY_MAP[currentDate.day()];

    // Calculate week range (Sunday to Saturday)
    const weekStart = currentDate.startOf("week"); // Sunday 00:00:00
    const weekEnd = currentDate.endOf("week"); // Saturday 23:59:59

    // 1) Find the active workout plan
    const activeWorkoutPlan = await prisma.workoutPlan.findFirst({
      where: {
        userId: dto.userId,
        isActive: true,
      },
      include: {
        workoutDays: {
          include: {
            workoutExercises: true,
            sessions: true,
          },
        },
      },
    });

    if (!activeWorkoutPlan) {
      throw new Error("Active workout plan not found");
    }

    // 2) Find today's workout day
    const todayWorkoutDay = activeWorkoutPlan.workoutDays.find(
      (day) => day.weekDay === currentWeekDayName,
    );

    if (!todayWorkoutDay) {
      throw new Error("Workout day not found for today");
    }

    // 3) Fetch all sessions for the week
    const weekSessions = await prisma.workoutSession.findMany({
      where: {
        workoutDay: {
          workoutPlan: {
            userId: dto.userId,
          },
        },
        startedAt: {
          gte: weekStart.toDate(),
          lte: weekEnd.toDate(),
        },
      },
    });

    // 4) Build consistencyByDay (Sunday to Saturday, all 7 days)
    const consistencyByDay: Record<
      string,
      { workoutDayCompleted: boolean; workoutDayStarted: boolean }
    > = {};

    for (let i = 0; i < 7; i++) {
      const day = weekStart.add(i, "day");
      const dayKey = day.format("YYYY-MM-DD");

      const daySessions = weekSessions.filter(
        (s) => dayjs.utc(s.startedAt).format("YYYY-MM-DD") === dayKey,
      );

      const workoutDayStarted = daySessions.length > 0;
      const workoutDayCompleted = daySessions.some(
        (s) => s.completedAt !== null,
      );

      consistencyByDay[dayKey] = {
        workoutDayCompleted,
        workoutDayStarted,
      };
    }

    // 5) Calculate workout streak
    let workoutStreak = 0;
    let checkDate = currentDate;

    while (true) {
      const checkWeekDayName = WEEKDAY_MAP[checkDate.day()];

      // Find if there's a workout day for this date in the active plan
      const workoutDayForDate = activeWorkoutPlan.workoutDays.find(
        (day) => day.weekDay === checkWeekDayName,
      );

      // If there's no workout day for this date, break the streak
      if (!workoutDayForDate) {
        break;
      }

      // Check if a session exists for this workout day on this date
      const sessionForDate = workoutDayForDate.sessions.find(
        (s) =>
          dayjs.utc(s.startedAt).format("YYYY-MM-DD") ===
          checkDate.format("YYYY-MM-DD"),
      );

      if (sessionForDate && sessionForDate.completedAt) {
        workoutStreak++;
      } else {
        break;
      }

      checkDate = checkDate.subtract(1, "day");
    }

    return {
      activeWorkoutPlanId: activeWorkoutPlan.id,
      todayWorkoutDay: {
        workoutPlanId: activeWorkoutPlan.id,
        id: todayWorkoutDay.id,
        name: todayWorkoutDay.name,
        isRest: todayWorkoutDay.isRest,
        weekDay: todayWorkoutDay.weekDay,
        estimatedDurationInSeconds: todayWorkoutDay.estimatedDurationSeconds,
        coverImageUrl: todayWorkoutDay.coverImageUrl,
        exercisesCount: todayWorkoutDay.workoutExercises.length,
      },
      workoutStreak,
      consistencyByDay,
    };
  }
}
