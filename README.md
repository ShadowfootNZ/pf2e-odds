# Pathfinder / Starfinder Odds Calculator

A static web app for calculating skill-challenge probabilities in **Pathfinder 2e** and **Starfinder 2e**, including exact degree-of-success shifts for nat-1 and nat-20.

Live at: [apps.shadowfoot.com/pf2e-odds](https://apps.shadowfoot.com/pf2e-odds)

---

## How it works

Enter a **Task DC**, optional modifiers, your **Skill** value, optional modifiers, and how many **Successes needed**. Results update on field change.

Outputs:

- **Expected rolls** to accumulate the required successes
- **Fulfilment** vs **Catastrophe** probability within *ceil(expected rolls)*, computed via a Markov chain
- **Per-roll odds** breakdown: Critical Success / Success / Failure / Critical Failure
- Nat-1 downgrade and nat-20 upgrade applied correctly per PF2e/SF2e rules

## License

[MIT](LICENSE) — not published, endorsed, or specifically approved by Paizo Inc.
