# World Morphing System Technical Design Document

| Metadata | Value |
| :--- | :--- |
| **Version** | 1.0.0 |
| **Last Updated** | 2025-11-29 |
| **Author** | Manus AI |
| **Status** | Draft |

---

## 1. Introduction

The **World Morphing System** is a multi-layered cellular automata simulation engine designed to model the dynamic evolution of a planetary ecosystem. It integrates geological, climatic, and biological systems into a unified feedback loop, creating an emergent world that feels alive and responsive.

This document details the technical architecture, core algorithms, and data structures used to implement the simulation.

## 2. System Architecture

The simulation is built upon a 2D grid-based engine where each cell contains state information for four distinct but interacting layers:

1.  **Mantle Layer (Geosphere)**: The foundation of the world, governing terrain existence and energy distribution.
2.  **Climate Layer (Atmosphere)**: Simulates temperature, wind, and weather events based on thermodynamic principles.
3.  **Crystal Layer (Resource)**: Models the growth, network, and energy management of crystalline structures (Alpha/Beta).
4.  **Bio Layer (Biosphere)**: Simulates the lifecycle, evolution, and expansion of biological entities (Humans and Aliens).

### 2.1 Data Structure

Each cell in the grid is defined by the `Cell` interface:

```typescript
interface Cell {
  x: number;
  y: number;
  
  // Mantle Layer
  exists: boolean;          // Is this cell part of the world?
  mantleEnergy: number;     // Energy level (0-100+)
  
  // Climate Layer
  temperature: number;      // Surface temperature in Celsius
  baseTemperature: number;  // Target temp derived from mantle & season
  
  // Crystal Layer
  crystalState: 'EMPTY' | 'ALPHA' | 'BETA' | 'BIO';
  storedEnergy: number;     // Energy stored in crystal/bio
  
  // Bio Layer
  prosperity: number;       // Health/Population metric
  bioAttributes?: BioAttributes; // Species-specific traits
}
```

## 3. Core Systems

### 3.1 Mantle Layer (Geosphere)

The Mantle Layer drives the physical shape of the world. It uses a continuous energy field to determine where land exists.

*   **Energy Field**: A noise-based field (Perlin/Simplex) that evolves over time.
*   **Dynamic Terrain**:
    *   **Expansion**: When `mantleEnergy > expansionThreshold`, the cell becomes land (`exists = true`).
    *   **Shrinkage**: When `mantleEnergy < shrinkThreshold`, the cell collapses into void (`exists = false`).
*   **Edge Supply Points**: Rotating energy injection points at the world's edge prevent the simulation from reaching a static equilibrium, constantly reshaping the borders.

### 3.2 Climate Layer (Atmosphere)

The Climate Layer simulates heat transfer using a simplified fluid dynamics model.

*   **Thermodynamics**:
    *   **Mantle Heating**: The ground is heated by the mantle energy below. The coupling strength is controlled by `mantleHeatingRate`.
    *   **Diffusion**: Heat spreads to neighbors ($T_{new} = T_{old} + k \cdot \nabla^2 T$).
    *   **Advection (Wind)**: Heat is transported by wind. Wind velocity is proportional to the temperature gradient ($\vec{v} \propto -\nabla T$). An upwind scheme is used for numerical stability.
    *   **Radiation**: Heat is lost to space based on the Stefan-Boltzmann law approximation.
*   **Weather**:
    *   **Thunderstorms**: Generated in areas with high energy and steep temperature gradients. They provide burst energy to crystals.

### 3.3 Crystal Layer (Resource)

Crystals are the bridge between raw energy and biological life.

*   **Alpha Crystals (Green)**:
    *   **Role**: Energy harvesters.
    *   **Mechanism**: Absorb energy directly from the Mantle Layer.
    *   **Network**: Share energy with connected neighbors to balance the grid.
    *   **Radiation**: Emit Alpha Radiation that harms non-immune biological life.
*   **Beta Crystals (Blue)**:
    *   **Role**: Energy batteries / stabilizers.
    *   **Mechanism**: Do not absorb mantle energy but have high storage capacity.
    *   **Mining**: Can be mined by biological civilizations for prosperity bonuses.

### 3.4 Bio Layer (Biosphere)

The Bio Layer simulates civilizations and ecosystems.

*   **Prosperity**: The core metric for a civilization's success.
    *   **Growth**: Increases when temperature is within the `minTemp` and `maxTemp` range.
    *   **Stagnation/Decay**: Growth slows or reverses when temperature deviates from the ideal range. Extreme temperatures cause rapid decline.
*   **Expansion**:
    *   **Settlement**: When prosperity exceeds `expansionThreshold`, a new settlement may form in an adjacent cell.
    *   **Migration**: With probability `migrantExpansionProb`, a "Migrant" entity is spawned instead. Migrants move independently across the map, allowing species to cross voids or hostile terrain.
*   **Evolution**:
    *   **Mutation**: New settlements have a chance (`mutationRate`) to alter their attributes (e.g., temperature tolerance, growth rate), potentially creating a new species ID.
*   **Radiation Resistance**:
    *   **Dynamic Immunity**: Biological entities with `prosperity > radiationImmunityThreshold` become immune to Alpha Radiation, simulating technological or biological adaptation.

## 4. Simulation Loop

The engine runs on a discrete time step system:

1.  **Update Mantle**: Apply noise, update supply points, calculate energy field.
2.  **Update Terrain**: Process expansion/shrinkage accumulators.
3.  **Update Climate**: Calculate diffusion, advection, mantle heating, and radiation.
4.  **Update Crystals**: Absorb energy, share within network, process decay.
5.  **Update Bio**: Calculate prosperity changes, handle expansion/migration, process radiation damage.
6.  **Interaction**: Handle mining, combat (competition), and extinction events.

## 5. Configuration & Tuning

The system exposes a wide range of `SimulationParams` to the UI, allowing real-time tuning of:

*   **Physics**: Diffusion rates, advection strength, mantle coupling.
*   **Biology**: Growth rates, temperature tolerances, mutation probabilities.
*   **World Gen**: Noise scale, edge generation parameters.

This data-driven approach allows for rapid prototyping and balancing of the simulation dynamics.
