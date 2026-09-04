# transcription-service-worker-interface

Scala model of the messages exchanged with the external transcription service, generated from
[`worker-interface-schema.json`](./worker-interface-schema.json) (a copy of the schema published by
[transcription-service](https://github.com/guardian/transcription-service), which produces it from
its Zod types).

Everything lives in a single generated file,
`src/main/scala/com/gu/transcriptionservice/workerinterface/TranscriptionWorkerInterface.scala`,
which is checked in so it is available to the rest of the build without any extra steps (`common`
depends on this project, so `backend` and `cli` get it transitively).

## Regenerating

Generation is a manual step. After updating `worker-interface-schema.json`, run:

```
sbt generateTranscriptionWorkerInterface
```

Then run the tests and commit the result:

```
sbt transcriptionWorkerInterface/test
```

## What gets generated

The generator lives in
[`project/TranscriptionWorkerInterfaceGenerator.scala`](../project/TranscriptionWorkerInterfaceGenerator.scala)
and handles the subset of JSON Schema that Zod emits:

| Schema                                        | Scala                                                           |
| --------------------------------------------- | --------------------------------------------------------------- |
| `type: object`                                | `final case class` + Play JSON `Format`                          |
| property not in `required`                    | `Option[...]`, omitted from the JSON when `None`                 |
| `type: string` with `enum`                    | `sealed abstract class` + `case object`s, encoded as strings     |
| `type: string` with `const`                   | discriminator: a `val` on the companion, not a constructor arg   |
| `oneOf` of `$ref`s sharing a `const` property | `sealed trait` + `Reads` that dispatches on the discriminator    |
| identical inline objects/enums                | one shared type (e.g. a single `CombinedOutputUrl`)              |

Anything outside that subset (`allOf`, `anyOf`, tuple `items`, ...) makes the generator fail loudly
rather than quietly emitting something wrong.

For this to work, every branch of a `oneOf` must be a `$ref` to a named definition. If you add a
variant in the transcription service, register it as a named Zod schema (and use
`z.discriminatedUnion`) rather than declaring it inline in the union.

### Discriminators

`status` / `jobType` are `const` in the schema, so they carry no information once you know which
variant you have. They are therefore *not* constructor parameters. They are still read from and
written to JSON, and are exposed as a `def` so the sealed trait can declare them:

```scala
sealed trait TranscriptionOutput {
  def id: String
  def userEmail: String
  def status: String
}

final case class LLMOutputSuccess(id: String, userEmail: String, outputKey: String)
    extends TranscriptionOutput {
  def status: String = LLMOutputSuccess.StatusValue
}
```

This means pattern matches over `TranscriptionOutput` are checked for exhaustiveness, so adding a
new variant to the schema becomes a compile error rather than a runtime `JsError`.

### Deliberate omissions

- `additionalProperties: false` is not enforced. Play JSON ignores unknown fields, which is what
  lets the transcription service deploy a new field ahead of Giant.
- The language code enums are generated in full, but Giant's own richer `model.Language` type is
  hand written; convert at the boundary rather than replacing it.
