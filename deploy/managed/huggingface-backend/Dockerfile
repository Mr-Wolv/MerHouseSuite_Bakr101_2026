FROM eclipse-temurin:21-jdk AS build

WORKDIR /workspace/backend
COPY backend/ /workspace/backend/
RUN chmod +x mvnw && ./mvnw -B -DskipTests package

FROM eclipse-temurin:21-jre

ENV SERVER_PORT=7860
ENV PORT=7860
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75 -XX:InitialRAMPercentage=25 -XX:+ExitOnOutOfMemoryError"

WORKDIR /app
COPY --from=build /workspace/backend/target/*.jar /app/app.jar

EXPOSE 7860

CMD ["java", "-jar", "/app/app.jar"]
