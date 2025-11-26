<p align="center">

  <img alt="Overmind" src="https://raw.githubusercontent.com/overmindtech/cli/a824e776f5db7c351c9222ab3da8cfef43f1e306/assets/logo.png" width="124px" align="center">

    <h3 align="center">

      <a href="https://app.overmind.tech/changes/df4c4cb0-beef-48b2-9917-9ea4b534126f">Open in Overmind ↗  </a>

   </h3>

</p>

---

`model|risks_v6`

<h3>🔴 Change Signals</h3>

**Routine** 🔴 `▇▅▃▂▁` AWS ECS task definitions showing first ever modifications across multiple attributes, which is unusual compared to typical patterns.

<a href="https://app.overmind.tech/changes/df4c4cb0-beef-48b2-9917-9ea4b534126f/signals">View signals ↗</a>

---

<h3>🔥 Risks</h3>

**Changing container health check to 8080 while service and ALB remain on 1234 will cause ECS to mark tasks unhealthy and drop ALB targets** `‼️High`  [Open Risk ↗](https://app.overmind.tech/changes/df4c4cb0-beef-48b2-9917-9ea4b534126f/blast-radius?selectedRisk=62ab7a12-346c-4ec1-8a1d-606fd716be90)

The ECS task definition facial-recognition-terraform-example will change its container health check to probe localhost:8080 while the service continues to listen and be exposed on port 1234. The current task definition maps containerPort/hostPort 1234 and the ALB target group facerec-terraform-example routes and health-checks on port 1234, with target 10.0.1.185:1234 currently healthy.

When the new task definition deploys, the container health check on 8080 will fail because nothing is listening on that port. ECS will mark the container unhealthy and stop/restart tasks, causing the ALB target on 10.0.1.185:1234 to churn or drop to zero healthy targets. This will interrupt traffic and can cause service downtime during and after the rollout until ports are aligned.

**CloudFront error response change will remove 403 custom page and enable error caching for 404s, serving wrong pages and caching negative responses** `❗Medium`  [Open Risk ↗](https://app.overmind.tech/changes/df4c4cb0-beef-48b2-9917-9ea4b534126f/blast-radius?selectedRisk=17bc773d-18de-4ee8-bc25-7ea452c1ee21)

The CloudFront distribution 540044833068.cloudfront-distribution.EX4HFUQMZ2ULI is changing its custom error responses so that the 403 mapping is removed and two 404 mappings are defined, one of which points to /errors/403.html. This will cause 404 responses to render the wrong error page and 403 responses to lose their current custom page, altering what end users see.

Additionally, ErrorCachingMinTTL is being changed from 0 to unset (null). With the explicit zero removed, CloudFront's default error caching will apply, so 404 responses will be cached rather than bypassed. Users can continue seeing stale 404s for objects that appear shortly after first request, and origin S3 access patterns will change due to negative caching at the edge.

---

<h3>🟣 Expected Changes</h3>

<details>

<summary> +/- ecs-task-definition › facial-recognition-terraform-example</summary>

```diff

--- current

+++ proposed

@@ -2,17 +2,23 @@

 id: github.com/overmindtech/terraform-example.ecs-task-definition.module.scenarios[0].aws_ecs_task_definition.face

 attributes:

-  arn: arn:aws:ecs:eu-west-2:540044833068:task-definition/facial-recognition-terraform-example:9

-  arn_without_revision: arn:aws:ecs:eu-west-2:540044833068:task-definition/facial-recognition-terraform-example

-  container_definitions: '[{"cpu":1024,"environment":[{"name":"DATABASE_URL","value":"tf-20251117235257281600000001.cnx7xf6hwmba.eu-west-2.rds.amazonaws.com"}],"essential":true,"healthCheck":{"command":["CMD-SHELL","wget -q --spider localhost:1234"],"interval":30,"retries":3,"timeout":5},"image":"harshmanvar/face-detection-tensorjs:slim-amd","memory":2048,"mountPoints":[],"name":"facial-recognition","portMappings":[{"appProtocol":"http","containerPort":1234,"hostPort":1234,"protocol":"tcp"}],"systemControls":[],"volumesFrom":[]}]'

+  arn: (known after apply)

+  arn_without_revision: (known after apply)

+  container_definitions: '[{"cpu":1024,"environment":[{"name":"DATABASE_URL","value":"tf-20251117235257281600000001.cnx7xf6hwmba.eu-west-2.rds.amazonaws.com"}],"essential":true,"healthCheck":{"command":["CMD-SHELL","wget -q --spider localhost:8080"],"interval":30,"retries":3,"timeout":5},"image":"harshmanvar/face-detection-tensorjs:slim-amd","memory":2048,"mountPoints":[],"name":"facial-recognition","portMappings":[{"appProtocol":"http","containerPort":1234}],"volumesFrom":[]}]'

   cpu: "1024"

-  enable_fault_injection: false

+  enable_fault_injection: (known after apply)

+  execution_role_arn: null

   family: facial-recognition-terraform-example

-  id: facial-recognition-terraform-example

+  id: (known after apply)

+  ipc_mode: null

   memory: "2048"

   network_mode: awsvpc

+  pid_mode: null

   requires_compatibilities:

     - FARGATE

-  revision: 9

+  revision: (known after apply)

   tags: null

   tags_all: (known after apply)

   task_role_arn: null

   terraform_address: module.scenarios[0].aws_ecs_task_definition.face

   terraform_name: module.scenarios[0].aws_ecs_task_definition.face

```

</details>

<details>

<summary> ~ cloudfront-distribution › EX4HFUQMZ2ULI</summary>

```diff

--- current

+++ proposed

@@ -6,9 +6,9 @@

   comment: My awesome CloudFront

   custom_error_response:

-    - error_caching_min_ttl: 0

-      error_code: 403

-      response_code: 403

+    - error_caching_min_ttl: null

+      error_code: 404

+      response_code: 404

       response_page_path: /errors/403.html

-    - error_caching_min_ttl: 0

+    - error_caching_min_ttl: null

       error_code: 404

       response_code: 404

```

</details>

---

<h3>🟠 Unmapped Changes</h3>

<details>

<summary> ~ aws_ecs_service › module.scenarios[0].aws_ecs_service.face</summary>

```diff

--- current

+++ proposed

@@ -38,5 +38,5 @@

   propagate_tags: NONE

   scheduling_strategy: REPLICA

-  task_definition: arn:aws:ecs:eu-west-2:540044833068:task-definition/facial-recognition-terraform-example:9

+  task_definition: (known after apply)

   terraform_address: module.scenarios[0].aws_ecs_service.face

   terraform_name: module.scenarios[0].aws_ecs_service.face

```

</details>

---

<h3>💥 Blast Radius</h3>

**Items** ` 19 `

**Edges** ` 84 `

<!-- Sticky Pull Request Commentchange -->

