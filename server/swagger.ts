import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import { Express } from "express";

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "YOZGO API Documentation",
      version: "1.0.0",
      description: "O'zbekistondagi eng yirik tez yozish platformasining API hujjatlari.",
      contact: {
        name: "YOZGO Team",
        url: "https://yozgo.uz",
      },
    },
    servers: [
      {
        url: "http://localhost:5000",
        description: "Development server",
      },
      {
        url: "https://yozgo.uz",
        description: "Production server",
      },
    ],
    components: {
      securitySchemes: {
        cookieAuth: {
          type: "apiKey",
          in: "cookie",
          name: "connect.sid",
        },
      },
    },
  },
  // API fayllari yo'llari (JSDoc izohlarini shu fayllardan qidiradi)
  apis: ["./server/routes.ts", "./server/auth.ts"],
};

const swaggerSpec = swaggerJsdoc(options);

export function setupSwagger(app: Express) {
  // Swagger UI route
  app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

  // JSON formatdagi spec (kerak bo'lsa)
  app.get("/api/docs.json", (req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.send(swaggerSpec);
  });

  console.log("Swagger hujjatlari yuklandi: /api/docs");
}
