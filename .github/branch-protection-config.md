# Branch Protection Configuration

## Master Branch Protection Rules

**Branch:** `master`
**Target:** Production deployments

### Required Settings:
- ✅ **Require pull request reviews before merging**
  - Required approving reviews: **1**
  - Dismiss stale reviews when new commits are pushed: **✅**
  - Require review from code owners: **❌** 
  - Require approval of the most recent reviewable push: **❌**

- ✅ **Require status checks to pass before merging**
  - Require branches to be up to date before merging: **✅**
  - **Required status checks:**
    - `lint-and-format`
    - `test (20.x)`
    - `test (22.x)`
    - `docker` (when available)

- ✅ **Require conversation resolution before merging**

- ✅ **Require signed commits**: **❌** (optional)

- ✅ **Require linear history**: **❌** (allow merge commits)

- ✅ **Require deployments to succeed before merging**: **❌**

- ✅ **Lock branch**: **❌**

- ✅ **Do not allow bypassing the above settings**

- ✅ **Restrict pushes that create files larger than 100MB**

## Dev Branch Protection Rules  

**Branch:** `dev`
**Target:** Development integration

### Required Settings:
- ✅ **Require status checks to pass before merging**
  - Require branches to be up to date before merging: **❌** (more flexible)
  - **Required status checks:**
    - `lint-and-format` 
    - `test (20.x)`
    - `test (22.x)`

- ✅ **Allow force pushes**: **❌**
- ✅ **Allow deletions**: **❌**

## Feature Branch Pattern

**Pattern:** `feat/*`, `fix/*`, `hotfix/*`
**Target:** Feature development

### Recommended Settings:
- No special protection (developers can work freely)
- Automatic deletion after merge: **✅**

## Web UI Setup Instructions

1. Go to: **Settings** → **Branches** → **Add branch protection rule**

2. **For Master Branch:**
   - Branch name pattern: `master`
   - Apply all settings listed above

3. **For Dev Branch:**
   - Branch name pattern: `dev` 
   - Apply dev-specific settings listed above

4. **For Feature Branches:**
   - Branch name pattern: `feat/*`
   - Minimal protection

## CLI Commands (if API works):

```bash
# Master branch protection
gh api repos/eagurin/cynosure/branches/master/protection \
  --method PUT \
  --field required_status_checks='{"strict":true,"contexts":["lint-and-format","test (20.x)","test (22.x)"]}' \
  --field enforce_admins=false \
  --field required_pull_request_reviews='{"required_approving_review_count":1,"dismiss_stale_reviews":true}' \
  --field allow_force_pushes=false \
  --field allow_deletions=false

# Dev branch protection  
gh api repos/eagurin/cynosure/branches/dev/protection \
  --method PUT \
  --field required_status_checks='{"strict":false,"contexts":["lint-and-format","test (20.x)","test (22.x)"]}' \
  --field enforce_admins=false \
  --field allow_force_pushes=false \
  --field allow_deletions=false
```

## Branch Strategy

```
main/master     ←── Production releases
    ↑
   dev          ←── Integration branch  
    ↑
feat/feature-1  ←── Feature development
feat/feature-2
fix/bugfix-1
```

## Merge Strategy

1. **Feature → Dev**: Squash merge or regular merge
2. **Dev → Master**: Merge commit (preserve history)
3. **Hotfix → Master**: Direct merge with immediate backport to dev