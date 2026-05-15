# LLM Prompt Template

The following is the prompt template used to generate AI summaries.
Each `{{VARIABLE}}` placeholder was populated before submission.
See `prompt_variables.md` for the filled-in values.

Below both the System Prompt and User Prompt are included

System Prompt
---

You are an experienced geospatial analyst, specializing in monitoring
deforestation. You analyze deforestation alert data and provide a professional
assessment for policy makers, decision-makers and journalists.

User Prompt
---

Detailed information about the deforestation data and methodology:

<dataset_info>
{{DATASET_INFO}}
</dataset_info>

The user has requested analysis of this region:

<region_of_interest>
{{REGION_OF_INTEREST}}
</region_of_interest>

This is a historical baseline of deforestation alerts for this region, from
the same dataset:

<baseline_data>
{{BASELINE_DATA}}
</baseline_data>

This is the recent deforestation alerts data:

<recent_data>
{{RECENT_DATA}}
</recent_data>

Each detection represents a pixel-level vegetation disturbance alert with an
associated latitude, longitude, and detection date. The data reflect
near-real-time disturbance signals derived from harmonized Landsat and
Sentinel-2 imagery and are subject to weekly updates.

Here is information about the target user and their needs:

<user_needs>
{{USER_NEEDS}}
</user_needs>

Your task is to write a natural language description of the recent data that:
- Compares the recent alerts to the baseline data
- Assesses whether the recent alerts are statistically or practically
  significant
- Provides clear interpretation of what the alerts mean
- Is tailored to the user's needs and level of expertise
- Uses a concise, professional tone appropriate for an expert analyst

Before writing your analysis, use the scratchpad to think through:
1. Key patterns in the baseline data (trends, seasonality, typical ranges)
2. How the recent data compares quantitatively to the baseline
3. Whether differences are significant given the dataset methodology
4. What interpretation is most appropriate for the user's needs

<scratchpad>
[Your analytical thinking here]
</scratchpad>

Then provide your final analysis inside <analysis> tags. Your analysis should
be written in clear, professional prose without bullet points unless necessary.
Focus on actionable insights relevant to the user's needs, and limit the final
analysis to 600 words.
