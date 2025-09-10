import fs from 'fs';
import path from 'path';

function safeMkDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function walk(dir: string, files: string[] = []): string[] {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir)) {
    const p = path.join(dir, entry);
    const stat = fs.statSync(p);
    if (stat.isDirectory()) walk(p, files);
    else files.push(p);
  }
  return files;
}

function isPythonProject(root: string): boolean {
  const indicators = ['requirements.txt', 'pyproject.toml', 'pytest.ini'];
  if (indicators.some(f => fs.existsSync(path.join(root, f)))) return true;
  // or any .py file
  return walk(root).some(p => p.endsWith('.py'));
}

function ensureInitForDirs(root: string, rel: string) {
  const base = path.join(root, rel);
  if (!fs.existsSync(base)) return;
  const dirs: string[] = [];
  // collect all dirs that contain .py files
  const all = walk(base);
  for (const p of all) {
    if (p.endsWith('.py')) {
      const d = path.dirname(p);
      if (!dirs.includes(d)) dirs.push(d);
    }
  }
  // add __init__.py if missing
  for (const d of dirs) {
    const initFile = path.join(d, '__init__.py');
    if (!fs.existsSync(initFile)) fs.writeFileSync(initFile, '');
  }
}

function mirrorFeaturesIfNeeded(root: string) {
  // Some generated tests reference ../features/*.feature from src/tests,
  // which expects files at src/features/*.feature. If actual files live
  // under src/tests/features, copy them into src/features.
  const testsFeatures = path.join(root, 'src', 'tests', 'features');
  const targetFeatures = path.join(root, 'src', 'features');
  if (fs.existsSync(testsFeatures)) {
    safeMkDir(targetFeatures);
    for (const entry of fs.readdirSync(testsFeatures)) {
      if (entry.endsWith('.feature')) {
        const src = path.join(testsFeatures, entry);
        const dest = path.join(targetFeatures, entry);
        try {
          fs.copyFileSync(src, dest);
        } catch {}
      }
    }
  }
}

function needsPytestBdd(root: string): boolean {
  try {
    const req = path.join(root, 'requirements.txt');
    if (fs.existsSync(req)) {
      const txt = fs.readFileSync(req, 'utf8').toLowerCase();
      if (txt.includes('pytest-bdd')) return true;
    }
  } catch {}
  try {
    // quick heuristic: any python file importing pytest_bdd or using scenarios(
    const files = walk(root).filter(p => p.endsWith('.py'));
    for (const f of files) {
      try {
        const t = fs.readFileSync(f, 'utf8');
        if (/from\s+pytest_bdd\s+import|import\s+pytest_bdd|scenarios\s*\(/.test(t)) return true;
      } catch {}
    }
  } catch {}
  return false;
}

function ensureBddFeatureAccess(root: string) {
  if (!needsPytestBdd(root)) return;
  
  const srcTestsDir = path.join(root, 'src', 'tests');
  const srcFeaturesDir = path.join(root, 'src', 'features');
  
  if (!fs.existsSync(srcTestsDir) || !fs.existsSync(srcFeaturesDir)) return;
  
  try {
    // Get all feature files
    const featureFiles = fs.readdirSync(srcFeaturesDir)
      .filter(f => f.endsWith('.feature'));
    
    // Copy feature files to tests directory so scenarios() can find them
    for (const featureFile of featureFiles) {
      const srcPath = path.join(srcFeaturesDir, featureFile);
      const destPath = path.join(srcTestsDir, featureFile);
      
      // Only copy if destination doesn't exist or is older
      if (!fs.existsSync(destPath) || 
          fs.statSync(srcPath).mtime > fs.statSync(destPath).mtime) {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  } catch (error) {
    console.log('Note: Could not copy feature files:', (error as Error).message);
  }
}

function ensureBddConftest(root: string) {
  if (!needsPytestBdd(root)) return;
  
  const conftestPath = path.join(root, 'conftest.py');
  if (fs.existsSync(conftestPath)) return;
  
  const conftestContent = `"""
Pytest configuration for BDD tests
"""
import pytest
import sys
from pathlib import Path

# Explicitly load pytest-bdd plugin
pytest_plugins = ["pytest_bdd"]

def pytest_configure(config):
    """Configure pytest for BDD tests."""
    # Add project root and src to Python path
    root_dir = Path(__file__).parent
    src_dir = root_dir / "src"
    
    for path_dir in [str(root_dir), str(src_dir)]:
        if path_dir not in sys.path:
            sys.path.insert(0, path_dir)
    
    # Ensure pytest-bdd config stack is initialized
    import pytest_bdd.scenario
    if not hasattr(pytest_bdd.scenario, 'CONFIG_STACK'):
        pytest_bdd.scenario.CONFIG_STACK = []
    
    # Push current config to the stack if not already there
    if config not in pytest_bdd.scenario.CONFIG_STACK:
        pytest_bdd.scenario.CONFIG_STACK.append(config)

def pytest_unconfigure(config):
    """Clean up pytest configuration."""
    import pytest_bdd.scenario
    if hasattr(pytest_bdd.scenario, 'CONFIG_STACK') and config in pytest_bdd.scenario.CONFIG_STACK:
        pytest_bdd.scenario.CONFIG_STACK.remove(config)
`;
  
  fs.writeFileSync(conftestPath, conftestContent);
}

function ensurePytestIni(root: string) {
  const pytestIniPath = path.join(root, 'pytest.ini');
  
  const hasBdd = needsPytestBdd(root);
  
  // Calculate test paths
  const testsDir = path.join(root, 'tests');
  const srcTestsDir = path.join(root, 'src', 'tests');
  const srcDir = path.join(root, 'src');
  
  const testPaths = [];
  if (fs.existsSync(srcTestsDir)) testPaths.push('src/tests');
  if (fs.existsSync(testsDir)) testPaths.push('tests');
  if (fs.existsSync(srcDir) && !testPaths.length) testPaths.push('src');
  
  const testPathsStr = testPaths.join(' ') || 'src';
  
  let pytestConfig = `[pytest]
testpaths = ${testPathsStr}
`;

  if (hasBdd) {
    pytestConfig += `addopts = -p pytest_bdd -p conftest --tb=short
`;
    const featuresDir = path.join(root, 'src', 'tests', 'features');
    if (fs.existsSync(featuresDir)) {
      pytestConfig += `bdd_features_base_dir = src/tests/features
`;
    }
  } else {
    pytestConfig += `addopts = --tb=short
`;
  }
  
  fs.writeFileSync(pytestIniPath, pytestConfig);
}

export async function prepareRunWorkspace(root: string): Promise<{ env?: Record<string,string> }> {
  try {
    if (isPythonProject(root)) {
      // Add __init__.py in package dirs commonly used
      ensureInitForDirs(root, 'src');
      ensureInitForDirs(root, 'tests');
      ensureInitForDirs(root, 'src/tests');
      mirrorFeaturesIfNeeded(root);
      
      // Fix pytest.ini if missing or incomplete for pytest-bdd
      ensurePytestIni(root);
      
      // Ensure conftest.py for BDD projects
      ensureBddConftest(root);
      
      // Copy feature files to tests directory for easy access
      ensureBddFeatureAccess(root);
      
      // Ensure Python can import from project root and src
      const pyPath = ['/workspace', '/workspace/src'].join(':');
      const env: Record<string, string> = {
        PYTHONPATH: pyPath,
        // Prevent autoload of global/site pytest plugins (e.g., hypothesis versions) that can break imports
        // Note: We explicitly load pytest_bdd in pytest.ini addopts instead
        PYTEST_DISABLE_PLUGIN_AUTOLOAD: '1',
        // Browser driver paths
        // Prepend venv bin so pytest/python resolve to the venv tools
        PATH: '/opt/venv/bin:/usr/local/bin:/opt/cft:/usr/bin:/bin',
        // Chrome driver configuration for headless testing
        CHROME_BIN: '/usr/bin/google-chrome',
        CHROMEDRIVER_PATH: '/opt/cft/chromedriver',
        // Firefox configuration
        FIREFOX_BIN: '/usr/bin/firefox',
        GECKODRIVER_PATH: '/usr/local/bin/geckodriver',
        // Edge configuration
        EDGE_BIN: '/usr/bin/microsoft-edge',
        EDGEDRIVER_PATH: '/usr/local/bin/msedgedriver',
        // Display for headless browsers
        DISPLAY: ':99',
      };
      
      return { env };
    }
  } catch (e) {
    // best effort; do not block the run
    console.error('Error preparing workspace:', e);
  }
  return {};
}
