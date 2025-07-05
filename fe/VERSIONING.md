# 🔖 Versioning Guide for CSV Tools Frontend

This guide explains how to manage versions for the CSV Tools Frontend application.

## 📋 Versioning Strategy

We use **Semantic Versioning (SemVer)** with the format: `MAJOR.MINOR.PATCH`

### Version Types:
- **PATCH** (1.0.0 → 1.0.1): Bug fixes, small improvements
- **MINOR** (1.0.0 → 1.1.0): New features, enhancements  
- **MAJOR** (1.0.0 → 2.0.0): Breaking changes, major rewrites

## 🚀 How to Release New Versions

### Method 1: Using NPM Scripts (Recommended)

```bash
# For bug fixes and small improvements
npm run version:patch

# For new features
npm run version:minor

# For breaking changes
npm run version:major
```

### Method 2: Using the Version Script Directly

```bash
# Bug fixes (1.0.0 → 1.0.1)
node version.js patch

# New features (1.0.0 → 1.1.0)
node version.js minor

# Breaking changes (1.0.0 → 2.0.0)
node version.js major
```

### Method 3: Manual NPM Version

```bash
# Traditional npm versioning
npm version patch
npm version minor
npm version major
```

## 📝 Complete Release Process

1. **Prepare your changes**
   ```bash
   git add .
   git commit -m "feat: add new CSV validation feature"
   ```

2. **Check current version**
   ```bash
   npm run version:check
   ```

3. **Create new version**
   ```bash
   npm run version:minor  # or patch/major
   ```

4. **Push to GitHub**
   ```bash
   git push origin main --tags
   ```

5. **Create GitHub Release**
   - Go to GitHub repository
   - Click "Releases" → "Create a new release"
   - Select the new tag
   - Add release notes

## 📊 Version Examples

### Patch Release (1.0.0 → 1.0.1)
- Fix CSV parsing bug
- Improve error messages
- Update documentation
- Performance optimizations

### Minor Release (1.0.0 → 1.1.0)
- Add new CSV validation tool
- Enhance UI with dark mode
- Add export formats (Excel, JSON)
- New configuration options

### Major Release (1.0.0 → 2.0.0)
- Complete UI redesign
- Change API structure
- Remove deprecated features
- Migration to new framework

## 🛠️ Automated Features

Our version management system automatically:
- ✅ Updates `package.json` version
- ✅ Updates `version.json` with release date
- ✅ Creates git commit with version bump
- ✅ Creates git tag for the release
- ✅ Prevents versioning with uncommitted changes

## 📁 Files Updated During Versioning

- `package.json` - Main version number
- `version.json` - Extended version info
- `CHANGELOG.md` - Release notes (manual)
- Git tags - For GitHub releases

## 🔍 Checking Version Information

```bash
# Check current version
npm run version:check

# View version history
git tag -l

# View specific version info
git show v1.0.0
```

## 📚 Best Practices

1. **Always test before versioning**
   ```bash
   npm run build
   npm run preview
   ```

2. **Update CHANGELOG.md**
   - Add release notes
   - Document breaking changes
   - List new features

3. **Use conventional commits**
   ```bash
   git commit -m "feat: add new feature"
   git commit -m "fix: resolve parsing issue"
   git commit -m "docs: update README"
   ```

4. **Version frequently**
   - Small, frequent releases
   - Easy to rollback if needed
   - Better user experience

## 🎯 Release Checklist

- [ ] All tests passing
- [ ] Build successful
- [ ] Documentation updated
- [ ] CHANGELOG.md updated
- [ ] Version bumped
- [ ] Git tag created
- [ ] Pushed to GitHub
- [ ] GitHub release created

## 🆘 Troubleshooting

### "You have uncommitted changes"
```bash
git status
git add .
git commit -m "your message"
```

### "Not a git repository"
```bash
git init
git add .
git commit -m "initial commit"
```

### Wrong version bumped
```bash
# Reset to previous commit
git reset --hard HEAD~1
git tag -d v1.0.1  # delete wrong tag
```

## 🎊 Congratulations!

You now have a professional versioning system for your CSV Tools app! 🚀
