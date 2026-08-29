# THE Philosophy — Design Engineering

**Author:** John Holt, Raibach Interactive Design Studio
**Status:** Working doctrine — practiced daily in this repository since 2026
**Companion documents:** [`SPECIFICATIONS.md`](../SPECIFICATIONS.md) (protocol conformance) · [`A2UI_TRUE_VS_FAKE_AUDIT.md`](A2UI_TRUE_VS_FAKE_AUDIT.md) (the method applied under fire)

---


## The underlying philosophy: 

Geert Trooskens and your architecture share the exact same conceptual North Star—**moving away from runtime stochastic interpretation and shifting intelligence to a single generation or compilation phase.**

When you look at your [Interactive Design System](https://github.com/Raibach/Interactive-Design-System) repository through the lens of *Compiled AI*, the mapping becomes fascinating:

* **In Trooskens’s Paper:** They take a high-level YAML specification, pass it through a code foundry with templates and modules, invoke the LLM once during compilation to generate a deterministic Temporal activity, validate it through a strict security/syntax/execution pipeline, and then run it at zero marginal token cost.
* 
* **In Your Architecture:** You are applying that exact compilation/determinism ethos to the **design-to-code and UI architecture layer**. Instead of treating design systems as static documentation or leaving UI generation to runtime chat prompts (which drift, hallucinate, and break component tokens), you are treating design tokens and components as strict compilation targets. The intelligence compiles the visual structure and constraints down into a deterministic, predictable code layer (akin to advanced code-gen engines like Figma's token bridges), ensuring that output is governed by the system's rules rather than runtime model variance.

Where you and Trooskens diverge is not the core philosophy—it’s the **domain boundary and execution target**. He is solving enterprise backend workflows and healthcare compliance pipelines via Python/Temporal. You are solving the UI architecture and design-system integrity problem, locking down how design tokens compile safely into code without letting runtime AI erode system architecture.

What the Paper is Actually Saying
https://mikehix.substack.com/p/from-ai-assistance-to-autonomous
From AI Assistance to Autonomous Execution
A practical look at running autonomous coding loops inside a disciplined engineering framework.
Mike Hicks
Mar 05, 2026

The paper is arguing for a total inversion of the traditional path:Treating the LLM as a Compiler, Not an Operator: Instead of keeping the LLM in the runtime loop to interpret natural language on every single user transaction (which is slow, non-deterministic, and expensive), the LLM is invoked once at generation time.The Codebase as the Ground-Truth Reference: The LLM doesn't just write code out of thin air; it is constrained by pre-validated templates, modules, and domain rule blocks. It uses the existing codebase structure as its boundary so that it compiles logic that strictly respects system constraints.Deterministic Execution: Once compiled, the LLM exits the execution path entirely. What runs in production is pure, static, deterministic code (like Temporal activities) that has zero runtime token drift, zero prompt injection surface, and instant execution speeds.Why This Aligns With Your ViewThis is fundamentally AI-native engineering, not a traditional software development pipeline. In a traditional pipeline, humans write the code, and CI tests it. In this compiled AI model, the AI generates the code artifact during a compilation phase, passes it through an automated multi-stage validation pipeline (security, syntax, execution, and accuracy checks), and locks it down into static, sovereign code.You are looking at codebases not as manual text documents to be edited by hand, but as reference registries that bind the AI's output so it never drifts, maintaining absolute determinism.Does capturing this specific mechanism—using AI natively to compile structured, drift-free code artifacts that then run independently of any cloud runtime—closer to the foundation you are trying to build?
