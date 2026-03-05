import { fromNodeHeaders } from "better-auth/node";
import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";

import { WeekDay } from "../generated/prisma/enums.js";
import { auth } from "../lib/auth.js";
import {
  ErrorSchema,
  getWorkoutPlanSchema,
  startWorkoutSessionSchema,
  updateWorkoutSessionSchema,
  workoutPlanSchema,
} from "../schemas/index.js";
import {
  CreateWorkoutPlan,
  InputDto,
  OutputDto,
} from "../usecases/CreateWorkoutPlan.js";
import {
  GetWorkoutPlan,
  InputDto as GetPlanInputDto,
  OutputDto as GetPlanOutputDto,
} from "../usecases/GetWorkoutPlan.js";
import {
  InputDto as StartSessionInputDto,
  OutputDto as StartSessionOutputDto,
  StartWorkoutSession,
  WorkoutPlanNotActiveError,
  WorkoutSessionAlreadyStartedError,
} from "../usecases/StartWorkoutSession.js";
import {
  InputDto as UpdateSessionInputDto,
  OutputDto as UpdateSessionOutputDto,
  UpdateWorkoutSession,
} from "../usecases/UpdateWorkoutSession.js";

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

  app.withTypeProvider<ZodTypeProvider>().route({
    method: "PATCH",
    url: "/:workoutPlanId/days/:workoutDayId/sessions/:workoutSessionId",
    schema: {
      tags: ["Workout Plan"],
      summary: "Update a workout session",
      description: "Updates a workout session with completion data",
      params: z.object({
        workoutPlanId: z.string().uuid(),
        workoutDayId: z.string().uuid(),
        workoutSessionId: z.string().uuid(),
      }),
      body: z.object({
        completedAt: z.string().datetime(),
      }),
      response: {
        200: updateWorkoutSessionSchema,
        401: ErrorSchema,
        403: ErrorSchema,
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

      const dto: UpdateSessionInputDto = {
        userId: session.user.id,
        workoutPlanId: request.params.workoutPlanId,
        workoutDayId: request.params.workoutDayId,
        workoutSessionId: request.params.workoutSessionId,
        completedAt: request.body.completedAt,
      };

      try {
        const updateWorkoutSession = new UpdateWorkoutSession();
        const result: UpdateSessionOutputDto =
          await updateWorkoutSession.execute(dto);
        return reply.status(200).send(result);
      } catch (error) {
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
        if (
          error instanceof Error &&
          error.message === "Workout session not found"
        ) {
          return reply.status(404).send({
            error: error.message,
            code: "WORKOUT_SESSION_NOT_FOUND",
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

  app.withTypeProvider<ZodTypeProvider>().route({
    method: "GET",
    url: "/:workoutPlanId",
    schema: {
      tags: ["Workout Plan"],
      summary: "Get a workout plan",
      description: "Returns a workout plan with its days and exercise counts",
      params: z.object({
        workoutPlanId: z.string().uuid(),
      }),
      response: {
        200: getWorkoutPlanSchema,
        401: ErrorSchema,
        403: ErrorSchema,
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

      const dto: GetPlanInputDto = {
        userId: session.user.id,
        workoutPlanId: request.params.workoutPlanId,
      };

      try {
        const getWorkoutPlan = new GetWorkoutPlan();
        const result: GetPlanOutputDto = await getWorkoutPlan.execute(dto);
        return reply.status(200).send(result);
      } catch (error) {
        if (
          error instanceof Error &&
          error.message === "Workout plan not found"
        ) {
          return reply.status(404).send({
            error: error.message,
            code: "WORKOUT_PLAN_NOT_FOUND",
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
