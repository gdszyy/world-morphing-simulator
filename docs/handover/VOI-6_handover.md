# VOI-6 Handover Document

| Metadata | Value |
| :--- | :--- |
| **From Task** | VOI-6 (Web Prototype & Design) |
| **To Task** | VOI-7 (UE4 Implementation - Phase 1) |
| **Date** | 2025-11-29 |
| **Author** | Manus AI |
| **Status** | Ready for Transfer |

---

## 1. Core Instruction
**Objective**: Port the validated "World Morphing System" simulation logic from the TypeScript web prototype to **Unreal Engine 4 (C++)**.

**Critical Constraint**: The UE4 implementation must strictly **decouple the core simulation logic from visualization and parameter tuning**. The simulation engine should run as a pure data processing module, independent of rendering or UI, to support future headless operation or alternative visualizations.

## 2. Context Loading Guide
To understand the system architecture and logic, please review the following resources in order:

1.  **Technical Design Document**: `docs/tech/world_morphing_system_tdd.md`
    *   *Why*: Defines the authoritative architecture, layer interactions, and algorithms.
2.  **Reference Implementation**: `client/src/lib/simulation/engine.ts`
    *   *Why*: Contains the exact mathematical formulas for heat advection, mantle coupling, and bio expansion.
3.  **Key Logic Updates**:
    *   **Climate**: Uses an upwind scheme for heat advection; mantle coupling is weak (`0.005`).
    *   **Bio**: Uses probabilistic migrant generation instead of deterministic settlement expansion.
    *   **Geology**: Edge supply points shift radially based on `edgeGenerationOffset`.

## 3. Current Task Assignment
The project is transitioning from **Prototyping** to **Production Implementation**.

*   **Completed**: VOI-6 (Web Prototype, TDD, Parameter Tuning).
*   **Next Up**:
    *   **VOI-7**: UE4 Project Setup, Core Data Structures, and Mantle Layer Implementation.
    *   **VOI-8**: Climate Layer (Thermodynamics) and Crystal Layer Implementation.
    *   **VOI-9**: Bio Layer Implementation and System Integration.

## 4. Task Goals
1.  **Replicate Logic**: Ensure the UE4 C++ simulation behaves identically to the web prototype (within floating-point tolerance).
2.  **Performance**: Optimize the cellular automata loop for C++ (consider data locality/SoA vs AoS).
3.  **Decoupling**: Design the `USimulationEngine` (or equivalent) to have zero dependencies on `AActor`, `UUserWidget`, or `UWorld` rendering features.

## 5. Expected Deliverables
*   **Technical Design Document (TDD)**: *Completed* (`docs/tech/world_morphing_system_tdd.md`).
*   **UE4 Source Code**:
    *   Core data structures (`FCell`, `FGrid`).
    *   Simulation Subsystem or Component.
    *   Unit tests verifying logic against TDD specs.

## 6. Key Resources
*   **GitHub Repository**: `gdszyy/world-morphing-simulator`
    *   Contains the "Truth" logic in TypeScript.
*   **TDD**: `docs/tech/world_morphing_system_tdd.md`
    *   The blueprint for the C++ implementation.

## 7. Three-Phase Prompts (for VOI-7)

### Phase 1: Foundation & Data Structures
> "Initialize the UE4 project. Define the core `FCell` struct and `FGrid` class in C++. Ensure `FCell` contains all fields defined in the TDD (Section 2.1). Implement the grid initialization logic and memory management. Verify that the grid can store and retrieve cell data efficiently."

### Phase 2: Mantle Layer Logic
> "Implement the Mantle Layer logic in C++. Port the noise-based energy field generation and the dynamic terrain expansion/shrinkage algorithms from `engine.ts`. Implement the 'Edge Supply Point' logic, ensuring the radial offset works correctly. Create a simple debug output to verify the terrain shape matches the web prototype's logic."

### Phase 3: Decoupling Verification
> "Refactor the simulation loop to ensure it runs independently of the game thread's tick if needed (or at least independently of rendering). Define a clear API for the visualization layer to 'poll' data from the simulation engine, ensuring the engine never 'pushes' data to the view. Write a unit test that runs 100 ticks of the simulation without spawning a single Actor."
