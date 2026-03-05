import { fromNodeHeaders } from "better-auth/node";
import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";

import { auth } from "../lib/auth.js";
import { ErrorSchema, userTrainDataSchema } from "../schemas/index.js";
import {
  GetUserTrainData,
  InputDto,
  OutputDto,
} from "../usecases/GetUserTrainData.js";

export const userRoutes = async (app: FastifyInstance) => {
  app.withTypeProvider<ZodTypeProvider>().route({
    method: "GET",
    url: "/me",
    schema: {
      tags: ["User"],
      summary: "Get user training data",
      description:
        "Returns the authenticated user's training data, or null if not yet set",
      response: {
        200: userTrainDataSchema.nullable(),
        401: ErrorSchema,
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
      };

      try {
        const getUserTrainData = new GetUserTrainData();
        const result: OutputDto | null = await getUserTrainData.execute(dto);
        return reply.status(200).send(result);
      } catch (error) {
        app.log.error(error);
        return reply.status(500).send({
          error: "Internal Server Error",
          code: "INTERNAL_SERVER_ERROR",
        });
      }
    },
  });
};
