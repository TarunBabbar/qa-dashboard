# Use Node.js base image with browsers for testing
FROM mcr.microsoft.com/playwright:v1.40.0-jammy

# Set environment variables
ENV DEBIAN_FRONTEND=noninteractive
ENV PATH="/opt/venv/bin:$PATH"

# Install system dependencies and package managers
RUN apt-get update && apt-get install -y \
    curl \
    wget \
    git \
    build-essential \
    software-properties-common \
    apt-transport-https \
    ca-certificates \
    gnupg \
    lsb-release \
    unzip \
    libxml2-dev \
    libxslt-dev \
    pkg-config \
    zlib1g-dev \
    libffi-dev \
    libgmp-dev \
    libicu-dev \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python 3.11
RUN apt-get update && apt-get install -y \
    python3.11 \
    python3.11-venv \
    python3.11-dev \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

# Install Java 17
RUN apt-get update && apt-get install -y \
    openjdk-17-jdk \
    maven \
    && rm -rf /var/lib/apt/lists/*

# Install .NET 8.0
RUN wget https://packages.microsoft.com/config/ubuntu/22.04/packages-microsoft-prod.deb -O packages-microsoft-prod.deb && \
    dpkg -i packages-microsoft-prod.deb && \
    rm packages-microsoft-prod.deb && \
    apt-get update && \
    apt-get install -y dotnet-sdk-8.0 && \
    rm -rf /var/lib/apt/lists/*

# Install Go
RUN wget -O go.tar.gz https://go.dev/dl/go1.21.5.linux-amd64.tar.gz && \
    tar -C /usr/local -xzf go.tar.gz && \
    rm go.tar.gz

# Install Ruby
RUN apt-get update && apt-get install -y \
    ruby \
    ruby-dev \
    && rm -rf /var/lib/apt/lists/*

# Install PHP
RUN apt-get update && apt-get install -y \
    php8.1 \
    php8.1-cli \
    php8.1-curl \
    php8.1-xml \
    php8.1-mbstring \
    php8.1-zip \
    && rm -rf /var/lib/apt/lists/*

# Set environment variables for all languages
ENV JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
ENV MAVEN_HOME=/usr/share/maven
ENV GOROOT=/usr/local/go
ENV GOPATH=/root/go
ENV DOTNET_ROOT=/usr/share/dotnet
ENV PATH="$JAVA_HOME/bin:$MAVEN_HOME/bin:$GOROOT/bin:$GOPATH/bin:$DOTNET_ROOT:$PATH"
ENV PATH="/root/.composer/vendor/bin:/opt/zap:/opt/maven/bin:$PATH"

# Create and activate Python virtual environment
RUN python3.11 -m venv /opt/venv

# Install Composer for PHP
RUN curl -sS https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer

# Install Node.js testing frameworks and tools (using latest stable versions)
RUN npm install -g \
    jest@29.7.0 \
    mocha@10.2.0 \
    chai@4.3.10 \
    vitest@1.0.4 \
    @playwright/test@1.40.0 \
    playwright@1.40.0 \
    cypress@13.6.0 \
    webdriverio@8.24.0 \
    puppeteer@21.5.0 \
    testcafe@3.4.0 \
    supertest@6.3.3 \
    frisby@2.1.3 \
    axios@1.6.2 \
    @cucumber/cucumber@10.0.1 \
    artillery@2.0.3 \
    dredd@14.1.0 \
    @pact-foundation/pact@12.1.0 \
    mountebank@2.8.2 \
    mochawesome@7.1.3 \
    allure-commandline@2.24.1

# Install Python testing tools and frameworks (with compatible versions)
RUN pip install --upgrade pip && pip install \
    pytest==7.2.2 \
    unittest-xml-reporting==3.2.0 \
    requests==2.31.0 \
    httpx==0.25.2 \
    tavern==2.3.0 \
    schemathesis==3.19.7 \
    behave==1.2.6 \
    pytest-bdd==6.1.1 \
    robotframework==6.1.1 \
    robotframework-seleniumlibrary==6.2.0 \
    locust==2.17.0 \
    playwright==1.40.0 \
    selenium==4.15.2 \
    allure-pytest==2.13.2 \
    pytest-html==4.1.1 \
    pact-python==2.2.1 \
    responses==0.24.1

# Install Ruby testing tools and gems using Bundler (Gemfile)
# Use Bundler to resolve gem dependency conflicts (e.g. pact/rack)
RUN gem install bundler --no-document
RUN ruby -S bundle --version
COPY Gemfile Gemfile.lock* ./
RUN ruby -S bundle config set --local deployment 'false' && \
    ruby -S bundle config set --local path '/usr/local/bundle' || true
RUN ruby -S bundle install --jobs=4 --retry=3 --without development test

# Install PHP testing tools via Composer
RUN composer global config --no-plugins allow-plugins.pestphp/pest-plugin true && \
    composer global config --no-plugins allow-plugins.pact-foundation/composer-downloads-plugin true && \
    composer global require \
    phpunit/phpunit:^10.0 \
    pestphp/pest:^2.0 \
    codeception/codeception:^5.0 \
    guzzlehttp/guzzle:^7.0 \
    pact-foundation/pact-php:^10.0

# Install Go testing tools and dependencies
RUN go install github.com/onsi/ginkgo/v2/ginkgo@v2.13.2

# Install .NET testing tools globally
RUN dotnet tool install --global dotnet-reportgenerator-globaltool && \
    dotnet tool install --global SpecFlow.Plus.LivingDoc.CLI && \
    dotnet tool install --global coverlet.console && \
    dotnet tool install --global dotnet-stryker

# Java testing dependencies: use maintained pom.xml instead of inline echo
RUN mkdir -p /opt/java-deps
COPY backend/pom.xml /opt/java-deps/pom.xml
RUN mvn -q -f /opt/java-deps/pom.xml dependency:go-offline

# Install performance testing tools
RUN curl -s https://dl.k6.io/key.gpg | gpg --dearmor | tee /etc/apt/trusted.gpg.d/k6.gpg > /dev/null && \
    echo "deb https://dl.k6.io/deb stable main" | tee /etc/apt/sources.list.d/k6.list && \
    apt-get update && apt-get install -y k6 && \
    rm -rf /var/lib/apt/lists/*

# Install JMeter
RUN wget -q https://archive.apache.org/dist/jmeter/binaries/apache-jmeter-5.6.2.tgz && \
    tar -xzf apache-jmeter-5.6.2.tgz -C /opt && \
    ln -s /opt/apache-jmeter-5.6.2 /opt/jmeter && \
    rm apache-jmeter-5.6.2.tgz

# # Install security testing tools (OWASP ZAP)
# ARG ZAP_VERSION=2.14.0
# RUN set -e ; \
#     echo "Fetching ZAP ${ZAP_VERSION}..." ; \
#     ZAP_URL="https://github.com/zaproxy/zaproxy/releases/download/v${ZAP_VERSION}/ZAP_${ZAP_VERSION}_Linux.tar.gz" ; \
#     echo "URL: $ZAP_URL" ; \
#     curl -w '\nHTTP_STATUS:%{http_code}\n' -L --retry 5 --retry-delay 3 -o /tmp/zap.tgz "$ZAP_URL" > /tmp/zap.curl.out 2>&1 ; \
#     HTTP_CODE=$(grep HTTP_STATUS /tmp/zap.curl.out | sed 's/HTTP_STATUS://') ; \
#     if [ "$HTTP_CODE" != "200" ]; then echo "Failed to download ZAP (status $HTTP_CODE)" >&2; cat /tmp/zap.curl.out >&2; exit 1; fi ; \
#     if ! gzip -t /tmp/zap.tgz 2>/dev/null ; then echo "Downloaded file is not a valid gzip archive" >&2; head -40 /tmp/zap.curl.out >&2; file /tmp/zap.tgz >&2; exit 1; fi ; \
#     tar -xzf /tmp/zap.tgz -C /opt ; \
#     ln -sfn /opt/ZAP_${ZAP_VERSION} /opt/zap ; \
#     rm /tmp/zap.tgz /tmp/zap.curl.out ; \
#     test -f /opt/zap/zap.sh || (echo "ZAP launcher not found" >&2; exit 1)
# # Fallback (uncomment to install distro package version):
# # RUN apt-get update && apt-get install -y zaproxy && rm -rf /var/lib/apt/lists/*

# Install WireMock standalone
RUN wget -q https://repo1.maven.org/maven2/com/github/tomakehurst/wiremock-jre8-standalone/2.35.0/wiremock-jre8-standalone-2.35.0.jar -O /opt/wiremock.jar

# Install Allure reporting
RUN wget -q https://github.com/allure-framework/allure2/releases/download/2.24.1/allure-2.24.1.tgz && \
    tar -xzf allure-2.24.1.tgz -C /opt && \
    ln -s /opt/allure-2.24.1 /opt/allure && \
    rm allure-2.24.1.tgz

# Update PATH with all tool locations
ENV PATH="/opt/jmeter/bin:/opt/zap:/opt/allure/bin:$PATH"

# Create a verification script to check all installations
RUN echo '#!/bin/bash' > /opt/verify-tools.sh && \
    echo 'echo "Verifying all testing tools installation..."' >> /opt/verify-tools.sh && \
    echo 'echo "Node.js version: $(node --version)"' >> /opt/verify-tools.sh && \
    echo 'echo "npm version: $(npm --version)"' >> /opt/verify-tools.sh && \
    echo 'echo "Python version: $(python3 --version)"' >> /opt/verify-tools.sh && \
    echo 'echo "Java version: $(java --version | head -1)"' >> /opt/verify-tools.sh && \
    echo 'echo "Go version: $(go version)"' >> /opt/verify-tools.sh && \
    echo 'echo "Ruby version: $(ruby --version)"' >> /opt/verify-tools.sh && \
    echo 'echo "PHP version: $(php --version | head -1)"' >> /opt/verify-tools.sh && \
    echo 'echo ".NET version: $(dotnet --version)"' >> /opt/verify-tools.sh && \
    echo 'echo "Maven version: $(mvn --version | head -1)"' >> /opt/verify-tools.sh && \
    echo 'echo "Checking NPM packages..."' >> /opt/verify-tools.sh && \
    echo 'npm list -g --depth=0 jest playwright cypress @wdio/cli mocha nyc selenium-webdriver cucumberjs supertest k6 puppeteer stryker postman-newman 2>/dev/null || true' >> /opt/verify-tools.sh && \
    echo 'echo "Checking Python packages..."' >> /opt/verify-tools.sh && \
    echo 'pip list | grep -E "(pytest|selenium|playwright|requests|behave|robotframework|locust|coverage)" || true' >> /opt/verify-tools.sh && \
    echo 'echo "Checking Ruby gems..."' >> /opt/verify-tools.sh && \
    echo 'gem list | grep -E "(rspec|capybara|cucumber|selenium-webdriver|watir|site_prism)" || true' >> /opt/verify-tools.sh && \
    echo 'echo "Checking PHP packages..."' >> /opt/verify-tools.sh && \
    echo 'composer global show | grep -E "(phpunit|codeception|behat|selenium|guzzle)" || true' >> /opt/verify-tools.sh && \
    echo 'echo "Checking Go packages..."' >> /opt/verify-tools.sh && \
    echo 'ls /root/go/bin/ 2>/dev/null || echo "No Go packages found"' >> /opt/verify-tools.sh && \
    echo 'echo "Checking additional tools..."' >> /opt/verify-tools.sh && \
    echo 'echo "k6: $(k6 version 2>/dev/null || echo not found)"' >> /opt/verify-tools.sh && \
    echo 'echo "JMeter: $(/opt/jmeter/bin/jmeter --version 2>/dev/null | head -1 || echo not found)"' >> /opt/verify-tools.sh && \
    echo 'echo "ZAP: $(test -f /opt/zap/zap.sh && echo installed || echo not found)"' >> /opt/verify-tools.sh && \
    echo 'echo "Allure: $(allure --version 2>/dev/null || echo not found)"' >> /opt/verify-tools.sh && \
    echo 'echo "WireMock: $(test -f /opt/wiremock.jar && echo installed || echo not found)"' >> /opt/verify-tools.sh && \
    echo 'echo "Tool verification complete!"' >> /opt/verify-tools.sh && \
    chmod +x /opt/verify-tools.sh

# Set final environment variables and PATH
ENV JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
ENV MAVEN_HOME=/opt/maven
ENV DOTNET_ROOT=/usr/share/dotnet
ENV GOPATH=/root/go
ENV GOROOT=/usr/local/go
ENV PATH="$MAVEN_HOME/bin:$DOTNET_ROOT:$GOROOT/bin:$GOPATH/bin:/opt/jmeter/bin:/opt/zap:/opt/allure/bin:/root/.composer/vendor/bin:$PATH"

# Set up working directory
WORKDIR /app

# Install concurrently to run both frontend and backend
RUN npm install -g concurrently

# Copy application files
COPY package*.json ./
RUN npm install

COPY backend/package*.json ./backend/
RUN cd backend && npm install

COPY frontend/package*.json ./frontend/
RUN cd frontend && npm install

COPY . .

# Build the frontend
RUN cd frontend && npm run build

# Expose the ports for backend and frontend
EXPOSE 3000-3100
EXPOSE 3001

# Start both frontend and backend with enforced ports
CMD ["concurrently", "env PORT=3001 npm --prefix frontend start", "env PORT=3000 npm --prefix backend start"]