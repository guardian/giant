This project consists of a play framework scala application (backend/), a scala cli app (cli/) and a react frontend (frontend/). The scala backend
depends on neo4j, elasticsearch and minio/s3, which are defined in the docker-compose file.

The frontend of the application is part written in javascript and part in typescript. We have a preference for all new
frontend files to be in typescript. When editing existing javascript files they can be left in javascript.

We prefer a functional style of programming in both scala and typescript but prioritise readability over functional purity.

We also:
 - prefer idiomatic patterns and techniques
 - prefer simplicity over sophistication 
 - defer to the principle of least surprise - our code should make the reader feel capable rather than out of their depth
