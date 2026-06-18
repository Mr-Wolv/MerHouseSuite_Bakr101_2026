package com.merhouse.config;

import java.util.Properties;
import java.util.concurrent.Executor;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;


@Configuration
public class MailConfig {
    @Bean
    Executor emailDeliveryExecutor(
        @Value("${merhouse.email.delivery.pool-size:2}") int poolSize
    ) {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(poolSize);
        executor.setMaxPoolSize(poolSize);
        executor.setQueueCapacity(50);
        executor.setThreadNamePrefix("email-delivery-");
        executor.setRejectedExecutionHandler(new ThreadPoolExecutor.CallerRunsPolicy());
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(15);
        executor.initialize();
        return executor;
    }

    @Bean
    JavaMailSender javaMailSender(
        @Value("${spring.mail.host:localhost}") String host,
        @Value("${spring.mail.port:1025}") int port,
        @Value("${spring.mail.username:}") String username,
        @Value("${spring.mail.password:}") String password,
        @Value("${spring.mail.properties.mail.smtp.auth:false}") boolean smtpAuth,
        @Value("${spring.mail.properties.mail.smtp.starttls.enable:false}") boolean startTls,
        @Value("${merhouse.smtp.connection-timeout-ms:10000}") int connectionTimeoutMs,
        @Value("${merhouse.smtp.timeout-ms:10000}") int timeoutMs,
        @Value("${merhouse.smtp.write-timeout-ms:10000}") int writeTimeoutMs
    ) {
        JavaMailSenderImpl sender = new JavaMailSenderImpl();
        sender.setHost(host);
        sender.setPort(port);
        sender.setUsername(username);
        sender.setPassword(password);
        Properties properties = sender.getJavaMailProperties();
        properties.put("mail.smtp.auth", Boolean.toString(smtpAuth));
        properties.put("mail.smtp.starttls.enable", Boolean.toString(startTls));
        properties.put("mail.smtp.connectiontimeout", Integer.toString(connectionTimeoutMs));
        properties.put("mail.smtp.timeout", Integer.toString(timeoutMs));
        properties.put("mail.smtp.writetimeout", Integer.toString(writeTimeoutMs));
        return sender;
    }

    // Resend RestClient bean has been removed — email provider is now console-capture (log) mode.
}
