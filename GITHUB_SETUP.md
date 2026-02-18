# GitHub Repository Setup Instructions

## Step 1: Create Repository on GitHub

1. Go to https://github.com/new
2. Repository name: `global-finance` (or your preferred name)
3. Description: "Global Finance Management Reporting Platform - Next.js application with Excel data integration"
4. Choose **Private** (recommended for internal projects)
5. **DO NOT** initialize with README, .gitignore, or license (we already have these)
6. Click "Create repository"

## Step 2: Add Remote and Push

After creating the repository, GitHub will show you commands. Use these instead:

```bash
cd "C:\Users\phillip.murphy\Global Finance"
git remote add origin https://github.com/YOUR_USERNAME/global-finance.git
git branch -M main
git push -u origin main
```

Replace `YOUR_USERNAME` with your GitHub username and `global-finance` with your repository name.

## Alternative: Using SSH (if you have SSH keys set up)

```bash
git remote add origin git@github.com:YOUR_USERNAME/global-finance.git
git branch -M main
git push -u origin main
```

## Step 3: Verify

After pushing, verify by visiting:
`https://github.com/YOUR_USERNAME/global-finance`

Your code should now be on GitHub!

