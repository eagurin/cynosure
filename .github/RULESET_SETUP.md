# 🛡️ GitHub Rulesets Setup Guide

## Быстрая настройка через веб-интерфейс

### 📍 **Шаг 1: Переход к настройкам**
1. Открой: https://github.com/eagurin/cynosure/settings/rules
2. Нажми: **"New branch ruleset"**

---

## 🔒 **Ruleset #1: Production Protection (main/master)**

### ⚙️ **General Settings:**
- **Ruleset Name:** `Production Protection`
- **Enforcement status:** `Active`
- **Target branches:** 
  - `main`
  - `master`

### 📋 **Rules to Enable:**

#### ✅ **1. Restrict deletions**
- Prevent users from deleting matching branches

#### ✅ **2. Restrict force pushes** 
- Prevent force pushes to matching branches

#### ✅ **3. Require pull requests**
- **Required approving reviews:** `1`
- **Dismiss stale reviews when new commits are pushed:** ✅
- **Require review from code owners:** ❌
- **Require approval of the most recent reviewable push:** ❌
- **Require conversation resolution before merging:** ✅

#### ✅ **4. Require status checks to pass**
- **Require branches to be up to date before merging:** ✅
- **Required status checks:**
  - `lint-and-format`
  - `test (20.x)`  
  - `test (22.x)`

#### ✅ **5. Block force pushes**
- Prevent force pushes to matching branches

---

## 🔧 **Ruleset #2: Development Integration (dev)**

### ⚙️ **General Settings:**
- **Ruleset Name:** `Development Integration`
- **Enforcement status:** `Active`
- **Target branches:** 
  - `dev`

### 📋 **Rules to Enable:**

#### ✅ **1. Restrict deletions**
- Prevent users from deleting matching branches

#### ✅ **2. Require status checks to pass**
- **Require branches to be up to date before merging:** ❌ (more flexible)
- **Required status checks:**
  - `lint-and-format`
  - `test (20.x)`
  - `test (22.x)`

#### ❌ **No pull request requirements** (direct push allowed for dev)

---

## 🌿 **Ruleset #3: Feature Branch Rules (feat/*, fix/*, hotfix/*)**

### ⚙️ **General Settings:**
- **Ruleset Name:** `Feature Branch Rules`  
- **Enforcement status:** `Active`
- **Target branches:**
  - `feat/*`
  - `fix/*`
  - `hotfix/*`

### 📋 **Rules to Enable:**

#### ✅ **1. Require status checks to pass**
- **Required status checks:**
  - `lint-and-format`
  - `test (20.x)`
  - `test (22.x)`

#### ❌ **No deletion/force push restrictions** (developers can work freely)

---

## 🎯 **Expected Results:**

### 🔒 **Production (main/master):**
- Cannot push directly
- Must create PR with 1 approval
- All CI checks must pass
- Cannot delete or force push

### 🔧 **Development (dev):**
- Can push directly (after CI passes)
- All CI checks must pass
- Cannot delete branch

### 🌿 **Feature branches:**
- Can work freely
- CI checks required before merge
- Auto-cleanup after merge

---

## 🚀 **Quick CLI Alternative (if API works):**

```bash
# Check current rulesets
gh api repos/eagurin/cynosure/rulesets

# View specific ruleset
gh api repos/eagurin/cynosure/rulesets/{id}
```

---

## ✅ **Verification:**

После настройки проверь:

1. **Try to push to master directly:** ❌ Should be blocked
2. **Create PR to master:** ✅ Should require review
3. **Push to dev:** ✅ Should work after CI passes
4. **Create feature branch:** ✅ Should work normally

---

## 📚 **Resources:**
- [GitHub Rulesets Documentation](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets)
- [YouTube Tutorial](https://www.youtube.com/watch?v=NgLhYqkU4YM)

---

**🎬 Follow the YouTube video step-by-step with these exact settings!**