# MerHouse Backend — Hugging Face Docker Space
#
# Layer optimization: pom.xml/mvnw are copied first so Maven dependencies
# are cached across rebuilds unless pom.xml changes. On HF free tier
# (cpu-basic) this reduces rebuild time from ~15min to ~2min.

FROM eclipse-temurin:21-jdk AS build

ENV MAVEN_OPTS="-XX:MaxRAMPercentage=60 -XX:InitialRAMPercentage=25 -XX:+ExitOnOutOfMemoryError -Dhttps.protocols=TLSv1.2"

WORKDIR /workspace/backend

# Layer 1 — build configuration (cached unless pom.xml/.mvn changes)
COPY backend/.mvn .mvn
COPY backend/mvnw backend/mvnw.cmd backend/pom.xml ./
RUN chmod +x mvnw && ./mvnw -B -DskipTests dependency:go-offline -q

# Layer 2 — source code (cached unless src/ changes)
COPY backend/src src
# Layer 3 — build the application
RUN ./mvnw -B -DskipTests package -q

# ── Runtime image ──────────────────────────────────────────────
FROM eclipse-temurin:21-jre

ENV SERVER_PORT=7860
ENV PORT=7860
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75 -XX:InitialRAMPercentage=25 -XX:+ExitOnOutOfMemoryError"

WORKDIR /app
COPY --from=build /workspace/backend/target/*.jar /app/app.jar

EXPOSE 7860

CMD ["java", "-jar", "/app/app.jar"]
