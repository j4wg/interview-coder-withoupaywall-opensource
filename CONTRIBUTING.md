# Contributing to Interview Coder - Unlocked Edition

Thank you for your interest in contributing to Interview Coder - Unlocked Edition! This free, open-source tool exists to empower the coding community with accessible interview preparation resources, and your efforts can make it even better. We're thrilled to have you join us in this collaborative journey!

## Our Community Values

We're building a supportive and inclusive environment based on the following principles:

- **Collaborative Development**: We grow stronger by working together—let's avoid duplicating efforts and unite our skills.
- **Open Access**: This tool is for everyone, and we aim to keep it free and accessible to all who need it.
- **Continuous Improvement**: Every contribution, big or small, helps refine features like AI-powered analysis, invisibility, and debugging assistance.

## How to Get Started

### 1. Fork the Repository

- Visit the repository at [github.com/Ornithopter-pilot/interview-coder-withoupaywall-opensource](https://github.com/Ornithopter-pilot/interview-coder-withoupaywall-opensource).
- Click the "Fork" button to create your own copy.
- Clone your fork locally:
  ```bash
  git clone https://github.com/YOUR-USERNAME/interview-coder-withoupaywall-opensource.git
  ```
- Set up the upstream remote to sync with the original:
  ```bash
  git remote add upstream https://github.com/Ornithopter-pilot/interview-coder-withoupaywall-opensource.git
  ```

### 2. Create a Branch

- Create a descriptive branch for your work:
  ```bash
  git checkout -b feature/your-feature-name
  ```
- Examples: `feature/add-python-support`, `bugfix/fix-screenshot-capture`.
- Keep branches focused on a single feature or fix to streamline reviews.

### 3. Make and Test Your Changes

- Implement your improvements or fixes in the codebase (e.g., `electron/ProcessingHelper.ts`, `src/components/Settings/SettingsDialog.tsx`).
- Test thoroughly, especially for features like screenshot capture or AI integration, to ensure compatibility with macOS, Windows, and Linux.
- Follow the existing code style (TypeScript, React, Tailwind CSS) and run:

### 4. Commit and Push

- Commit your changes with clear messages:
  ```bash
  git commit -m "feat: add Python language support with detailed testing"
  ```
- Push to your fork:
  ```bash
  git push origin feature/your-feature-name
  ```

### 5. Submit a Pull Request (PR)

- Go to the original repository and click "New Pull Request".
- Select your branch and create the PR.
- Provide a detailed description:
  - What problem does it solve?
  - How was it tested?
  - Reference related issues (e.g., `Fixes #123`).
- Assign reviewers (e.g., `@anshumansingh01`, `@bhaumikmaan`) if applicable.

## Contribution Guidelines

To ensure a smooth and high-quality collaboration, please follow these guidelines:

### Code Quality

- Write clear, well-documented code. Add comments for complex logic (e.g., AI model integration in `ProcessingHelper.ts`).
- Test your changes locally using the provided `stealth-run.sh` or `stealth-run.bat` scripts.
- Avoid breaking existing features (e.g., invisibility, screenshot capture).

### PR Workflow

- All changes must be submitted via a PR to the main branch, as required by our branch protection rules.
- PRs require 2 approving reviews, including an independent approval of the most recent push (someone other than the pusher).
- Resolve all code-related conversations before merging—unresolved feedback will block the PR.
- Expect stale approvals to be dismissed if new commits are pushed, ensuring reviews reflect the latest code.

## Licensing and Attribution

This project is licensed under the GNU Affero General Public License v3.0 (AGPL-3.0). As a contributor:

- **Contribute Back**: Submit your improvements as PRs to the main repository to benefit the community.
- **Share Openly**: If you modify and deploy the software (e.g., on a server), make your source code available to users under AGPL-3.0.
- **Maintain Attribution**: Preserve original copyright notices and license text in your modifications.

## Community Etiquette

- Be respectful and constructive in comments and reviews.
- Actively review others' PRs to share the workload—your input is valuable!
- Report bugs or suggest features by opening an issue with:
  - A clear title.
  - Steps to reproduce.
  - Expected vs. actual behavior.

## Development Tips

- **Environment Setup**: Ensure Node.js (v16+) and npm/bun are installed. Grant screen recording permissions (see README.md for details).
- **API Usage**: Be mindful of OpenAI API costs when testing AI features.
- **Troubleshooting**: Run `npm run clean` before builds if issues arise, and use Ctrl+B/Cmd+B to toggle visibility.

## Maintainer Notes

As the primary maintainer, I (Ornithopter-pilot) oversee merges and ensure stability. Your PRs will be reviewed, but I rely on your help to maintain quality. Please:

- Ping me (@Ornithopter-pilot) if a PR is urgent.
- Be patient—high PR volume may delay responses.

## Thank You!

Your contributions make Interview Coder - Unlocked Edition a powerful, community-owned tool. Whether it's adding language support, enhancing UI, or fixing bugs, every effort counts. Let's build something amazing together!