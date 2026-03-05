import { fromNodeHeaders } from "better-auth/node";
import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";

import { WeekDay } from "../generated/prisma/enums.js";
import { auth } from "../lib/auth.js";
import { ErrorSchema, workoutPlanSchema } from "../schemas/index.js";
import {
  CreateWorkoutPlan,
  InputDto,
  OutputDto,
} from "../usecases/CreateWorkoutPlan.js";

export const workoutPlanRoutes = async (app: FastifyInstance) => {
  app.withTypeProvider<ZodTypeProvider>().route({
    method: "POST",
    url: "/",
    schema: {
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
};
