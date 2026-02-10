# Data Format Specification

## Overview

This document describes the data format for the {{ title }} benchmark.

## File Structure

```
data/
├── samples/                  # Individual test samples
│   ├── sample-001.json
│   └── ...
├── dataset_schema.json       # JSON Schema for validation
├── metadata.yaml             # Dataset metadata
└── README.md                 # Human-readable documentation
```

## Sample Schema

Each sample is a JSON file with the following structure:

```json
{
  "id": "string (required, unique)",
  "input": "string or object (required)",
  "expected": "string or object (required)",
  "metadata": {
    "category": "string (optional)",
    "difficulty": "easy | medium | hard (optional)",
    "source": "string (optional)",
    "tags": ["string"]
  }
}
```

## Field Descriptions

### id
- Unique identifier for the sample
- Format: `sample-NNN` or descriptive slug

### input
- The input to provide to the model
- CHANGEME: Describe expected format

### expected
- The expected/reference output
- CHANGEME: Describe expected format

### metadata.category
- High-level category for grouping
- CHANGEME: List valid categories

### metadata.difficulty
- Subjective difficulty rating
- Values: `easy`, `medium`, `hard`

## Validation

Validate samples against the schema:

```bash
# TODO: Add validation command
```

## Adding New Samples

1. Create a new JSON file in `data/samples/`
2. Follow the schema above
3. Run validation
4. Submit PR with description of new samples
