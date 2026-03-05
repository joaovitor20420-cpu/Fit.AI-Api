import { fromNodeHeaders } from "better-auth/node";
import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";

import { auth } from "../lib/auth.js";
import { ErrorSchema, homeDataSchema } from "../schemas/index.js";
import { GetHomeData, InputDto, OutputDto } from "../usecases/GetHomeData.js";

export const homeRoutes = async (app: FastifyInstance) => {
  app.withTypeProvider<ZodTypeProvider>().route({
    method: "GET",
    url: "/:date",
    schema: {
      tags: ["Home"],
      summary: "Get home page data",
      description:
        "Returns the authenticated user's home page data including today's workout, streak, and weekly consistency",
      params: z.object({
        date: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
      }),
      response: {
        200: homeDataSchema,
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
        date: request.params.date,
      };

      try {
        const getHomeData = new GetHomeData();
        const result: OutputDto = await getHomeData.execute(dto);
        return reply.status(200).send(result);
      } catch (error) {
        if (
          error instanceof Error &&
          error.message === "Active workout plan not found"
        ) {
          return reply.status(404).send({
            error: error.message,
            code: "ACTIVE_WORKOUT_PLAN_NOT_FOUND",
          });
        }
        if (
          error instanceof Error &&
          error.message === "Workout day not found for today"
        ) {
          return reply.status(404).send({
            error: error.message,
            code: "WORKOUT_DAY_NOT_FOUND",
          });
        }
        throw error;
      }
    },
  });
};
