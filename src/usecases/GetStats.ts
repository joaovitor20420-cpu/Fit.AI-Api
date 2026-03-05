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
  from: string;
  to: string;
}

export interface OutputDto {
  workoutStreak: number;
  consistencyByDay: Record<
    string,
    {
      workoutDayCompleted: boolean;
      workoutDayStarted: boolean;
    }
  >;
  completedWorkoutsCount: number;
  conclusionRate: number;
  totalTimeInSeconds: number;
}

export class GetStats {
  async execute(dto: InputDto): Promise<OutputDto> {
    const fromDate = dayjs.utc(dto.from, "YYYY-MM-DD").startOf("day");
    const toDate = dayjs.utc(dto.to, "YYYY-MM-DD").endOf("day");

    // Fetch all sessions in the range
    const sessions = await prisma.workoutSession.findMany({
      where: {
        workoutDay: {
          workoutPlan: {
            userId: dto.userId,
          },
        },
        startedAt: {
          gte: fromDate.toDate(),
          lte: toDate.toDate(),
        },
      },
    });

    // Build consistencyByDay (only days that have sessions)
    const consistencyByDay: Record<
      string,
      { workoutDayCompleted: boolean; workoutDayStarted: boolean }
    > = {};

    for (const session of sessions) {
      const dayKey = dayjs.utc(session.startedAt).format("YYYY-MM-DD");

      if (!consistencyByDay[dayKey]) {
        consistencyByDay[dayKey] = {
          workoutDayCompleted: false,
          workoutDayStarted: false,
        };
      }

      consistencyByDay[dayKey].workoutDayStarted = true;

      if (session.completedAt) {
        consistencyByDay[dayKey].workoutDayCompleted = true;
      }
    }

    // completedWorkoutsCount
    const completedWorkoutsCount = sessions.filter(
      (s) => s.completedAt !== null,
    ).length;

    // conclusionRate
    const conclusionRate =
      sessions.length > 0 ? completedWorkoutsCount / sessions.length : 0;

    // totalTimeInSeconds
    const totalTimeInSeconds = sessions
      .filter((s) => s.completedAt !== null)
      .reduce((total, s) => {
        const started = dayjs.utc(s.startedAt);
        const completed = dayjs.utc(s.completedAt!);
        return total + completed.diff(started, "second");
      }, 0);

    // workoutStreak: count backwards from "to" date
    const activeWorkoutPlan = await prisma.workoutPlan.findFirst({
      where: {
        userId: dto.userId,
        isActive: true,
      },
      include: {
        workoutDays: {
          include: {
            sessions: true,
          },
        },
      },
    });

    let workoutStreak = 0;

    if (activeWorkoutPlan) {
      let checkDate = toDate.startOf("day");

      while (true) {
        const checkWeekDayName = WEEKDAY_MAP[checkDate.day()];

        const workoutDayForDate = activeWorkoutPlan.workoutDays.find(
          (day) => day.weekDay === checkWeekDayName,
        );

        if (!workoutDayForDate) {
          break;
        }

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
    }

    return {
      workoutStreak,
      consistencyByDay,
      completedWorkoutsCount,
      conclusionRate,
      totalTimeInSeconds,
    };
  }
}
