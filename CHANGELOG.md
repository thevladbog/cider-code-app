## [1.0.0-beta.17](https://github.com/thevladbog/cider-code-app/compare/v1.0.0-beta.16...v1.0.0-beta.17) (2025-06-15)

### Bug Fixes

- fixed release flow ([31f2959](https://github.com/thevladbog/cider-code-app/commit/31f295942a6e2e19c2a4ded4ee6d6f357cb6b3cc))
- **style:** auto-format code after release [skip ci] ([dad69ac](https://github.com/thevladbog/cider-code-app/commit/dad69ac0cb06f0c9e3301f33ec0ed7ae7f4103d9))

## [1.0.0-beta.16](https://github.com/thevladbog/cider-code-app/compare/v1.0.0-beta.15...v1.0.0-beta.16) (2025-06-15)

### Bug Fixes

- fixed release flow ([c643b0d](https://github.com/thevladbog/cider-code-app/commit/c643b0d2debe110630518cdac0bce2206bebfe75))
- fixed release flow ([76b7847](https://github.com/thevladbog/cider-code-app/commit/76b784764ca389c36983d01d5b4b298b80a138f5))
- **style:** auto-format code after release [skip ci] ([436e28b](https://github.com/thevladbog/cider-code-app/commit/436e28bcf0936fcd2285b593a6280ceeb4f41eac))

## [1.0.0-beta.15](https://github.com/thevladbog/cider-code-app/compare/v1.0.0-beta.14...v1.0.0-beta.15) (2025-06-15)

### ⚠ BREAKING CHANGES

- Complete migration of build system and packaging

* Migrate from Webpack to Vite for faster development and building
* Replace Electron Forge with electron-builder for packaging
* Fix ESM/CommonJS conflicts by removing electron-store dependency
* Implement custom file-based store to avoid ESM-only packages
* Add cross-platform build configurations (Windows, Linux, macOS)
* Update GitHub Actions workflow for electron-builder
* Fix renderer loading path in production builds
* Add comprehensive icon sets for all platforms
* Remove deprecated test and build files
* Update all build scripts and configurations

Fixes startup crashes and enables proper cross-platform distribution.

### Features

- migrate from webpack+forge to vite+electron-builder ([2b90401](https://github.com/thevladbog/cider-code-app/commit/2b904013c0a33d192d0f28c27b2ad22412e47edd))

### Bug Fixes

- **style:** auto-format code after release [skip ci] ([450a68f](https://github.com/thevladbog/cider-code-app/commit/450a68f6c311c0aa88f9f8839b108c215ca9b0f9))

## [1.0.0-beta.14](https://github.com/thevladbog/cider-code-app/compare/v1.0.0-beta.13...v1.0.0-beta.14) (2025-06-15)

### Bug Fixes

- **style:** auto-format code after release [skip ci] ([ec69b61](https://github.com/thevladbog/cider-code-app/commit/ec69b61f91c826d76a727f89a6b7d90b00b163a8))
- update release.yml ([2e1f0b4](https://github.com/thevladbog/cider-code-app/commit/2e1f0b45a29af1d5273d356478ea2be265c01603))

## [1.0.0-beta.13](https://github.com/thevladbog/cider-code-app/compare/v1.0.0-beta.12...v1.0.0-beta.13) (2025-06-15)

### Bug Fixes

- **style:** auto-format code after release [skip ci] ([2974631](https://github.com/thevladbog/cider-code-app/commit/29746317ca34acabcc491993ea9e241e52e39dd6))
- update forge.config.ts ([16bd497](https://github.com/thevladbog/cider-code-app/commit/16bd497c0c6c42414e0170e0a45370b4c3184f17))
- update release.yml ([d396e01](https://github.com/thevladbog/cider-code-app/commit/d396e01f819bc0253942a713c6cf54e98ea9e4df))

## [1.0.0-beta.12](https://github.com/thevladbog/cider-code-app/compare/v1.0.0-beta.11...v1.0.0-beta.12) (2025-06-15)

### Bug Fixes

- **style:** auto-format code after release [skip ci] ([78e3f10](https://github.com/thevladbog/cider-code-app/commit/78e3f10441b1901f5daa55432ec5c85ce7223054))
- update release.yml ([b389e0c](https://github.com/thevladbog/cider-code-app/commit/b389e0c2d08cb1956b885d5e34847490d76fd5d2))

## [1.0.0-beta.11](https://github.com/thevladbog/cider-code-app/compare/v1.0.0-beta.10...v1.0.0-beta.11) (2025-06-15)

### Bug Fixes

- **style:** auto-format code after release [skip ci] ([c5f49c9](https://github.com/thevladbog/cider-code-app/commit/c5f49c93459bb54c6f1525aa527d1c67c60ffc9f))
- updated release.yml ([913cbd3](https://github.com/thevladbog/cider-code-app/commit/913cbd3906cc36d3e3215f303c8f6e3b479074a5))

## [1.0.0-beta.10](https://github.com/thevladbog/cider-code-app/compare/v1.0.0-beta.9...v1.0.0-beta.10) (2025-06-15)

### Bug Fixes

- update .releaserc.json ([66105e0](https://github.com/thevladbog/cider-code-app/commit/66105e06e05273f19e4044ab3f370596b89a5d55))
- update release.yml ([5ae4dae](https://github.com/thevladbog/cider-code-app/commit/5ae4daed9fa80bbb75b1ab7661e9996bbcec33d8))

## [1.0.0-beta.9](https://github.com/thevladbog/cider-code-app/compare/v1.0.0-beta.8...v1.0.0-beta.9) (2025-06-15)

### Bug Fixes

- Deleted CHANGELOG.md ([ad8727f](https://github.com/thevladbog/cider-code-app/commit/ad8727fdf16e321ae8f6d18129edec05bcfa0d2e))
- fixed release flow ([641886c](https://github.com/thevladbog/cider-code-app/commit/641886c3b08c205ae895b025808ead2a5c9376a4))
