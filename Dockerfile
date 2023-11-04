FROM docker.io/node:18-slim as migrate-db
COPY --chown=node:node ./postgres/migrate-db/package.json ./postgres/migrate-db/package-lock.json /migrate-db/
USER node
WORKDIR /migrate-db
RUN --mount=type=cache,target=/home/node/.npm,uid=1000,gid=1000 \
  npm ci --no-fund --no-audit
COPY --chown=node:node ./postgres/migrate-db /migrate-db
CMD ["npm", "run", "migrate"]

FROM docker.io/node:18-slim as builder
ARG DEBIAN_FRONTEND=noninteractive
ARG CI=true
ARG WHISPER_COMMIT_ID=fa8dbdc8886150254748854387ea9240385800e2
ARG WHISPER_MODEL=ggml-base.bin
ENV LANG=en_US.UTF-8
ENV LC_ALL=en_US.UTF-8
ENV LANGUAGE=en_US.UTF-8
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
  --mount=type=cache,target=/var/lib/apt,sharing=locked \
  apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates apt-transport-https gnupg && \
  echo "deb https://repo.scala-sbt.org/scalasbt/debian all main" > /etc/apt/sources.list.d/sbt.list && \
  apt-key adv --no-tty --keyserver hkp://keyserver.ubuntu.com:80 \
    --recv-keys 2EE0EA64E40A89B84B2DF73499E82A75642AC823 && \
  apt-get update && apt-get install -y --no-install-recommends \
    sbt git cmake make gcc g++ python3 wget default-jre-headless locales && \
  sed -i -e 's/# en_US.UTF-8 UTF-8/en_US.UTF-8 UTF-8/' /etc/locale.gen && \
  dpkg-reconfigure --frontend=noninteractive locales && \
  update-locale LANG=en_US.UTF-8
USER node
WORKDIR /whisper.cpp
RUN git clone https://github.com/ggerganov/whisper.cpp.git . && \
  git reset --hard "${WHISPER_COMMIT_ID}" && \
  make && \
  wget --no-config --quiet --show-progress -O "${WHISPER_MODEL}" "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/${WHISPER_MODEL}"
WORKDIR /frontend
COPY --chown=node:node ./frontend/package.json ./frontend/package-lock.json /frontend/
RUN --mount=type=cache,target=/home/node/.npm,uid=1000,gid=1000 \
  npm ci --no-fund --no-audit
COPY --chown=node:node ./frontend /frontend
ENV NODE_ENV=production
RUN node ./node_modules/react-scripts/bin/react-scripts build
COPY --chown=node:node . /app
WORKDIR /app
RUN --mount=type=cache,target=/home/node/.ivy2,uid=1000,gid=1000,sharing=locked \
  --mount=type=cache,target=/home/node/.sbt,uid=1000,gid=1000,sharing=locked \
  cp -R /frontend/build/ /app/backend/public/ && \
  sbt backend/stage && \
  sbt cli/stage

FROM docker.io/debian:bookworm-slim as runner
ARG UID=1000
ARG GID=1000
ARG USER=giant
ARG DEBIAN_FRONTEND=noninteractive
ARG WHISPER_MODEL=ggml-base.bin
ENV LANG=en_US.UTF-8
ENV LC_ALL=en_US.UTF-8
ENV LANGUAGE=en_US.UTF-8
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
  --mount=type=cache,target=/var/lib/apt,sharing=locked \
  apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates default-jre-headless locales \
    wkhtmltopdf qpdf ocrmypdf imagemagick tesseract-ocr-all ffmpeg \
    libreoffice-nogui libreoffice-core-nogui libreoffice-java-common && \
  groupadd --force -g "${GID}" "${USER}" && \
  useradd -ms /bin/bash -u "${UID}" -g "${GID}" "${USER}" && \
  mkdir -p /opt/whisper/whisper.cpp && \
  sed -i -e 's/# en_US.UTF-8 UTF-8/en_US.UTF-8 UTF-8/' /etc/locale.gen && \
  dpkg-reconfigure --frontend=noninteractive locales && \
  update-locale LANG=en_US.UTF-8
COPY --from=builder /app/backend/target/universal/stage/ /app/
COPY --from=builder /app/cli/target/universal/stage/ /cli/
COPY --from=builder /whisper.cpp/main /opt/whisper/whisper.cpp/
COPY --from=builder /whisper.cpp/${WHISPER_MODEL} /opt/whisper/whisper.cpp/
ENV PATH="/app/bin:/cli/bin:$PATH"
USER giant
CMD pfi