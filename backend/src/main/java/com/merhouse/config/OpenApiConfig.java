package com.merhouse.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springdoc.core.models.GroupedOpenApi;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {
    static final String BEARER_AUTH_SCHEME = "bearerAuth";
    static final String MERHOUSE_V1_GROUP = "merhouse-v1";

    @Bean
    OpenAPI merHouseOpenApi() {
        return new OpenAPI()
            .info(new Info()
                .title("MerHouse API")
                .version("v1")
                .description("REST API for merchant operations, warehouse fulfillment workflows, platform administration, and service accountability."))
            .components(new Components()
                .addSecuritySchemes(BEARER_AUTH_SCHEME, new SecurityScheme()
                    .name(BEARER_AUTH_SCHEME)
                    .type(SecurityScheme.Type.HTTP)
                    .scheme("bearer")
                    .bearerFormat("JWT")
                    .description("Paste a JWT from POST /api/v1/auth/login.")))
            .addSecurityItem(new SecurityRequirement().addList(BEARER_AUTH_SCHEME));
    }

    @Bean
    GroupedOpenApi merHouseV1Api() {
        return GroupedOpenApi.builder()
            .group(MERHOUSE_V1_GROUP)
            .pathsToMatch("/api/v1/**")
            .build();
    }
}
