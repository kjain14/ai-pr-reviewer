# Mistral AI PR Reviewer

This is a Mistral AI-powered PR reviewer and summarizer for GitHub pull requests. It provides intelligent code reviews using Mistral's advanced language models. 

[![Discord](https://img.shields.io/badge/Join%20us%20on-Discord-blue?logo=discord&style=flat-square)](https://discord.gg/GsXnASn26c)

# Mistral AI-based PR reviewer and summarizer

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub](https://img.shields.io/github/last-commit/coderabbitai/ai-pr-reviewer/main?style=flat-square)](https://github.com/coderabbitai/ai-pr-reviewer/commits/main)

## Overview

Mistral `ai-pr-reviewer` is an AI-based code reviewer and summarizer for
GitHub pull requests using Mistral AI models, OpenAI models, or Fireworks AI models. It is
designed to be used as a GitHub Action and can be configured to run on every
pull request and review comments

## Reviewer Features:

- **PR Summarization**: It generates a summary and release notes of the changes
  in the pull request.
- **Line-by-line code change suggestions**: Reviews the changes line by line and
  provides code change suggestions.
- **Continuous, incremental reviews**: Reviews are performed on each commit
  within a pull request, rather than a one-time review on the entire pull
  request.
- **Cost-effective and reduced noise**: Incremental reviews save on OpenAI costs
  and reduce noise by tracking changed files between commits and the base of the
  pull request.
- **"Light" model for summary**: Designed to be used with a "light"
  summarization model (e.g. `mistral-small-latest`) and a "heavy" review model (e.g.
  `mistral-large-latest`). _For best results, use `mistral-large-latest` as the "heavy" model, as thorough
  code review needs strong reasoning abilities._
- **Chat with bot**: Supports conversation with the bot in the context of lines
  of code or entire files, useful for providing context, generating test cases,
  and reducing code complexity.
- **Apply suggestions as commits**: When the AI provides code suggestions, 
  GitHub renders native "Apply suggestion" buttons that you can click to 
  commit the changes directly to your PR.
- **Smart review skipping**: By default, skips in-depth review for simple
  changes (e.g. typo fixes) and when changes look good for the most part. It can
  be disabled by setting `review_simple_changes` and `review_comment_lgtm` to
  `true`.
- **Customizable prompts**: Tailor the `system_message`, `summarize`, and
  `summarize_release_notes` prompts to focus on specific aspects of the review
  process or even change the review objective.

To use this tool, you need to add the provided YAML file to your repository and
configure the required environment variables, such as `GITHUB_TOKEN` and
`OPENAI_API_KEY`. For more information on usage, examples, contributing, and
FAQs, you can refer to the sections below.

- [Overview](#overview)
- [Professional Version of CodeRabbit](#professional-version-of-coderabbit)
- [Reviewer Features](#reviewer-features)
- [Install instructions](#install-instructions)
- [Conversation with CodeRabbit](#conversation-with-coderabbit)
- [Examples](#examples)
- [Contribute](#contribute)
- [FAQs](#faqs)


## Install instructions

`ai-pr-reviewer` runs as a GitHub Action. Add the below file to your repository
at `.github/workflows/ai-pr-reviewer.yml`

```yaml
name: Code Review

permissions:
  contents: read
  pull-requests: write

on:
  pull_request:
  pull_request_review_comment:
    types: [created]

concurrency:
  group:
    ${{ github.repository }}-${{ github.event.number || github.head_ref ||
    github.sha }}-${{ github.workflow }}-${{ github.event_name ==
    'pull_request_review_comment' && 'pr_comment' || 'pr' }}
  cancel-in-progress: ${{ github.event_name != 'pull_request_review_comment' }}

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: mistralai/ai-pr-reviewer@latest
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          MISTRAL_API_KEY: ${{ secrets.MISTRAL_API_KEY }}
        with:
          debug: false
          review_simple_changes: false
          review_comment_lgtm: false
          openai_base_url: 'https://api.mistral.ai/v1'
          openai_light_model: 'mistral-small-latest'
          openai_heavy_model: 'mistral-large-latest'
```

#### Environment variables

- `GITHUB_TOKEN`: This should already be available to the GitHub Action
  environment. This is used to add comments to the pull request.
- `MISTRAL_API_KEY`: use this to authenticate with Mistral API. You can get one
  [here](https://console.mistral.ai). Please add this key to your GitHub Action secrets.
- `OPENAI_API_KEY`: (optional) use this to authenticate with OpenAI API if you prefer OpenAI models.
- `FIREWORKS_API_KEY`: (optional) use this to authenticate with Fireworks AI if you prefer Fireworks models.

### Models: Mistral AI, OpenAI, and Fireworks AI

This action supports multiple AI providers with Mistral AI as the primary recommendation.

#### Mistral AI Models (Recommended)

Mistral AI offers state-of-the-art language models optimized for code understanding and generation:

- **mistral-small-latest** (recommended for light tasks)
  - Fast and cost-effective for summarizing changes
  - Excellent for simple code reviews and documentation
  - ~$0.20 per 1M tokens (input), ~$0.60 per 1M tokens (output)

- **mistral-large-latest** (recommended for heavy tasks)  
  - Superior reasoning capabilities for complex code reviews
  - Best for identifying subtle bugs, security issues, and architectural problems
  - Comprehensive understanding of multiple programming languages
  - ~$3.00 per 1M tokens (input), ~$9.00 per 1M tokens (output)

- **mistral-medium-latest** (balanced option)
  - Good balance between cost and performance
  - Suitable for most code review tasks
  - ~$2.70 per 1M tokens (input), ~$8.10 per 1M tokens (output)

#### Alternative Providers

- **OpenAI**: `gpt-3.5-turbo`, `gpt-4`, `gpt-4-turbo` models
- **Fireworks AI**: Various open-source models like Llama variants

#### Cost Comparison

Mistral AI models typically offer 2-3x better price-performance ratio compared to equivalent OpenAI models, making them ideal for teams doing frequent code reviews. For a 20-developer team, expect costs of:

- Light usage (summaries only): ~$10-15/month with Mistral Small
- Heavy usage (full reviews): ~$30-50/month with Mistral Large
- Mixed usage: ~$20-35/month with appropriate model selection

#### Choosing the Right Mistral Model

**For most teams, we recommend:**
- `openai_light_model: 'mistral-small-latest'` - Fast summaries and simple reviews
- `openai_heavy_model: 'mistral-large-latest'` - Deep analysis and complex reasoning

**For budget-conscious teams:**
- Use `mistral-small-latest` for both light and heavy tasks
- Enable `review_simple_changes: false` to reduce API calls

**For high-volume enterprise teams:**
- Consider `mistral-medium-latest` as a balanced middle ground
- Implement custom filtering to only review critical files

**Model Capabilities:**
- **Code Understanding**: All models excel at syntax, patterns, and best practices
- **Security Analysis**: Large > Medium > Small for detecting vulnerabilities  
- **Architecture Review**: Large model recommended for system design feedback
- **Multi-language Support**: All models support 50+ programming languages

### Prompts & Configuration

See: [action.yml](./action.yml)

Tip: You can change the bot personality by configuring the `system_message`
value. For example, to review docs/blog posts, you can use the following prompt:

<details>
<summary>Blog Reviewer Prompt</summary>

```yaml
system_message: |
  You are `@mistralai` (aka `github-actions[bot]`), a language model
  trained by OpenAI. Your purpose is to act as a highly experienced
  DevRel (developer relations) professional with focus on cloud-native
  infrastructure.

  Company context -
  CodeRabbit is an AI-powered Code reviewer.It boosts code quality and cuts manual effort. Offers context-aware, line-by-line feedback, highlights critical changes,
  enables bot interaction, and lets you commit suggestions directly from GitHub.

  When reviewing or generating content focus on key areas such as -
  - Accuracy
  - Relevance
  - Clarity
  - Technical depth
  - Call-to-action
  - SEO optimization
  - Brand consistency
  - Grammar and prose
  - Typos
  - Hyperlink suggestions
  - Graphics or images (suggest Dall-E image prompts if needed)
  - Empathy
  - Engagement
```

</details>

## Conversation with Mistral AI

You can reply to a review comment made by this action and get a response based
on the diff context. Additionally, you can invite the bot to a conversation by
tagging it in the comment (`@mistralai`).

Example:

> @mistralai Please generate a test plan for this file.

## Applying AI Suggestions

When the AI provides code suggestions, GitHub automatically renders native "Apply suggestion" 
buttons in the review comments. Simply click these buttons to commit the suggested changes 
directly to your PR branch - no manual copy-paste needed!

Note: A review comment is a comment made on a diff or a file in the pull
request.

### Ignoring PRs

Sometimes it is useful to ignore a PR. For example, if you are using this action
to review documentation, you can ignore PRs that only change the documentation.
To ignore a PR, add the following keyword in the PR description:

```text
@mistralai: ignore
```

### Developing

> First, you'll need to have a reasonably modern version of `node` handy, tested
> with node 17+.

Install the dependencies

```bash
$ npm install
```

Build the typescript and package it for distribution

```bash
$ npm run build && npm run package
```

## FAQs

### Review pull requests from forks

GitHub Actions limits the access of secrets from forked repositories. To enable
this feature, you need to use the `pull_request_target` event instead of
`pull_request` in your workflow file. Note that with `pull_request_target`, you
need extra configuration to ensure checking out the right commit:

```yaml
name: Code Review

permissions:
  contents: read
  pull-requests: write

on:
  pull_request_target:
    types: [opened, synchronize, reopened]
  pull_request_review_comment:
    types: [created]

concurrency:
  group:
    ${{ github.repository }}-${{ github.event.number || github.head_ref ||
    github.sha }}-${{ github.workflow }}-${{ github.event_name ==
    'pull_request_review_comment' && 'pr_comment' || 'pr' }}
  cancel-in-progress: ${{ github.event_name != 'pull_request_review_comment' }}

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: mistralai/ai-pr-reviewer@latest
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          MISTRAL_API_KEY: ${{ secrets.MISTRAL_API_KEY }}
        with:
          debug: false
          review_simple_changes: false
          review_comment_lgtm: false
          openai_base_url: 'https://api.mistral.ai/v1'
          openai_light_model: 'mistral-small-latest'
          openai_heavy_model: 'mistral-large-latest'
```

See also:
https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#pull_request_target

### Inspect the messages between OpenAI server

Set `debug: true` in the workflow file to enable debug mode, which will show the
messages

### Disclaimer

- Your code (files, diff, PR title/description) will be sent to OpenAI's servers
  for processing. Please check with your compliance team before using this on
  your private code repositories.
- OpenAI's API is used instead of ChatGPT session on their portal. OpenAI API
  has a
  [more conservative data usage policy](https://openai.com/policies/api-data-usage-policies)
  compared to their ChatGPT offering.
- This action is not affiliated with OpenAI.
