import { fromNodeHeaders } from "better-auth/node";
import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";

import { auth } from "../lib/auth.js";
import { ErrorSchema, statsSchema } from "../schemas/index.js";
import { GetStats, InputDto, OutputDto } from "../usecases/GetStats.js";

export const statsRoutes = async (app: FastifyInstance) => {
  app.withTypeProvider<ZodTypeProvider>().route({
    method: "GET",
    url: "/",
    schema: {
      tags: ["Stats"],
      summary: "Get workout statistics",
      description:
        "Returns workout statistics for the authenticated user within a date range",
      querystring: z.object({
        from: z.string().date(),
        to: z.string().date(),
      }),
      response: {
        200: statsSchema,
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
        from: request.query.from,
        to: request.query.to,
      };

      const getStats = new GetStats();
      const result: OutputDto = await getStats.execute(dto);
      return reply.status(200).send(result);
    },
  });
};
