package com.merhouse.config;

import static org.assertj.core.api.Assertions.assertThat;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.junit.jupiter.api.Test;
import org.springdoc.core.models.GroupedOpenApi;

class OpenApiConfigTest {
    private final OpenApiConfig config = new OpenApiConfig();

    @Test
    void documentsApiInfoAndBearerSecurityScheme() {
        OpenAPI openAPI = config.merHouseOpenApi();

        assertThat(openAPI.getInfo().getTitle()).isEqualTo("MerHouse API");
        assertThat(openAPI.getInfo().getVersion()).isEqualTo("v1");
        assertThat(openAPI.getInfo().getDescription())
            .contains("REST API for merchant operations", "warehouse fulfillment workflows");
        assertThat(openAPI.getComponents().getSecuritySchemes())
            .containsKey(OpenApiConfig.BEARER_AUTH_SCHEME);
        assertThat(openAPI.getComponents().getSecuritySchemes().get(OpenApiConfig.BEARER_AUTH_SCHEME).getType())
            .isEqualTo(SecurityScheme.Type.HTTP);
        assertThat(openAPI.getSecurity())
            .anySatisfy(requirement -> assertThat(requirement).containsKey(OpenApiConfig.BEARER_AUTH_SCHEME));
    }

    @Test
    void groupsVersionedMerHouseApi() {
        GroupedOpenApi groupedOpenApi = config.merHouseV1Api();

        assertThat(groupedOpenApi.getGroup()).isEqualTo(OpenApiConfig.MERHOUSE_V1_GROUP);
        assertThat(groupedOpenApi.getPathsToMatch()).containsExactly("/api/v1/**");
    }
}
