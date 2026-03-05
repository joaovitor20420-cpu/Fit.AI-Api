import { fromNodeHeaders } from "better-auth/node";
import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";

import { WeekDay } from "../generated/prisma/enums.js";
import { auth } from "../lib/auth.js";
import {
  ErrorSchema,
  startWorkoutSessionSchema,
  workoutPlanSchema,
} from "../schemas/index.js";
import {
  CreateWorkoutPlan,
  InputDto,
  OutputDto,
} from "../usecases/CreateWorkoutPlan.js";
import {
  InputDto as StartSessionInputDto,
  OutputDto as StartSessionOutputDto,
  StartWorkoutSession,
  WorkoutPlanNotActiveError,
  WorkoutSessionAlreadyStartedError,
} from "../usecases/StartWorkoutSession.js";

export const workoutPlanRoutes = async (app: FastifyInstance) => {
  app.withTypeProvider<ZodTypeProvider>().route({
    method: "POST",
    url: "/",
    schema: {
      tags: ["Workout Plan"],
      summary: "Create a workout plan",
      description: "Creates a workout plan for the authenticated user",
      body: z.object({
        name: z.string().trim().min(1),
        coverImageUrl: z.string().url().optional(),
        workoutDays: z.array(
          z.object({
            name: z.string().trim().min(1),
            weekDay: z.nativeEnum(WeekDay),
            isRest: z.boolean().default(false),
            coverImageUrl: z.string().url().optional(),
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
      }),
      response: {
        201: workoutPlanSchema.extend({
          id: z.string().uuid(),
        }),
        400: ErrorSchema,
        401: ErrorSchema,
        404: ErrorSchema,
        500: ErrorSchema,
      },
    },
    handler: async (request, reply) => {
      const session = await auth.api.getSession({
        headers: fromNodeHeaders(request.headers),
      });
      if (!session) {
        return reply.status(401).send({
          error: "Unauthorized",
          code: "UNAUTHORIZED",
        });
      }
      const dto: InputDto = {
        userId: session.user.id,
        name: request.body.name,
        coverImageUrl: request.body.coverImageUrl,
        workoutDays: request.body.workoutDays,
      };
      const createWorkoutPlan = new CreateWorkoutPlan();
      const result: OutputDto = await createWorkoutPlan.execute(dto);
      return reply.status(201).send(result);
    },
  });

  app.withTypeProvider<ZodTypeProvider>().route({
    method: "POST",
    url: "/:workoutPlanId/days/:workoutDayId/sessions",
    schema: {
      tags: ["Workout Plan"],
      summary: "Start a workout session",
      description:
        "Starts a workout session for a specific day in a workout plan",
      params: z.object({
        workoutPlanId: z.string().uuid(),
        workoutDayId: z.string().uuid(),
      }),
      response: {
        201: startWorkoutSessionSchema,
        401: ErrorSchema,
        403: ErrorSchema,
        404: ErrorSchema,
        409: ErrorSchema,
        500: ErrorSchema,
      },
    },
    handler: async (request, reply) => {
      const session = await auth.api.getSession({
        headers: fromNodeHeaders(request.headers),
      });
      if (!session) {
        return reply.status(401).send({
          error: "Unauthorized",
          code: "UNAUTHORIZED",
        });
      }

      const dto: StartSessionInputDto = {
        userId: session.user.id,
        workoutPlanId: request.params.workoutPlanId,
        workoutDayId: request.params.workoutDayId,
      };

      try {
        const startWorkoutSession = new StartWorkoutSession();
        const result: StartSessionOutputDto =
          await startWorkoutSession.execute(dto);
        return reply.status(201).send(result);
      } catch (error) {
        if (error instanceof WorkoutPlanNotActiveError) {
          return reply.status(409).send({
            error: error.message,
            code: "WORKOUT_PLAN_NOT_ACTIVE",
          });
        }
        if (error instanceof WorkoutSessionAlreadyStartedError) {
          return reply.status(409).send({
            error: error.message,
            code: "WORKOUT_SESSION_ALREADY_STARTED",
          });
        }
        if (
          error instanceof Error &&
          error.message === "Workout plan not found"
        ) {
          return reply.status(404).send({
            error: error.message,
            code: "WORKOUT_PLAN_NOT_FOUND",
          });
        }
        if (
          error instanceof Error &&
          error.message === "Workout day not found"
        ) {
          return reply.status(404).send({
            error: error.message,
            code: "WORKOUT_DAY_NOT_FOUND",
          });
        }
        if (error instanceof Error && error.message === "Forbidden") {
          return reply.status(403).send({
            error: "Forbidden",
            code: "FORBIDDEN",
          });
        }
        throw error;
      }
    },
  });
};
