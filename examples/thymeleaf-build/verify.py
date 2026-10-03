import hashlib, json, os, shutil, subprocess, urllib.request
from html.parser import HTMLParser
from pathlib import Path

root = Path(__file__).resolve().parent
probe = root
java = str(Path(os.environ["JAVA_HOME"]) / "bin/java") if os.environ.get("JAVA_HOME") else "java"
rendered = root / "verification/rendered"
rendered.mkdir(parents=True, exist_ok=True)
libs = root / "verification/lib"
libs.mkdir(exist_ok=True)
for dependency in json.loads((root / "java-dependencies.json").read_text()):
    target = libs / dependency["url"].rsplit("/", 1)[1]
    if not target.exists():
        with urllib.request.urlopen(dependency["url"], timeout=60) as response:
            payload = response.read()
        if hashlib.sha256(payload).hexdigest() != dependency["sha256"]:
            raise RuntimeError(f"Dependency checksum mismatch: {target.name}")
        target.write_bytes(payload)
    if hashlib.sha256(target.read_bytes()).hexdigest() != dependency["sha256"]:
        raise RuntimeError(f"Dependency checksum mismatch: {target.name}")

npm = "npm.cmd" if os.name == "nt" else "npm"
def build(*args):
    subprocess.run([npm, "exec", "--offline", "--", "parcel", "build", *args,
                    "--no-autoinstall"], cwd=root, check=True)

# Fresh baseline builds, with the current default HTML pipeline.
for directory, flags in [("dist-default", []), ("dist-no-optimize", ["--no-optimize"])]:
    build("src/original.html", "--no-cache", "--dist-dir", directory, *flags)
# Warm the cache, then repeat the complete production build.
build("src/**/*.html", "--config", "./legacy.parcelrc", "--dist-dir", "dist")
before = {str(p.relative_to(root / "dist")): hashlib.sha256(p.read_bytes()).hexdigest()
          for p in (root / "dist").rglob("*") if p.is_file() and p.name != "rendered.html"}
build("src/**/*.html", "--config", "./legacy.parcelrc", "--dist-dir", "dist")
after = {str(p.relative_to(root / "dist")): hashlib.sha256(p.read_bytes()).hexdigest()
         for p in (root / "dist").rglob("*") if p.is_file() and p.name != "rendered.html"}
assert before == after, "Cached rebuild changed emitted files"
voids = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"}

class Document(HTMLParser):
    def __init__(self, html):
        super().__init__(convert_charrefs=True)
        self.stack = []; self.nodes = []; self.tokens = []
        self.feed(html)
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        self.nodes.append({"tag":tag,"attrs":attrs,"ancestors":list(self.stack)})
        normalized = dict(attrs)
        for key in ("href", "src"):
            if key in normalized and normalized[key].endswith((".css", ".js")):
                normalized[key] = "RESOURCE" + Path(normalized[key]).suffix
        self.tokens.append(["start",tag,sorted(normalized.items())])
        if tag not in voids: self.stack.append(tag)
    def handle_endtag(self, tag):
        self.tokens.append(["end",tag])
        if tag in self.stack:
            while self.stack.pop() != tag: pass
    def handle_data(self, text):
        text = " ".join(text.split())
        if text: self.tokens.append(["text",text])

def render(directory, template, output, title, description, details):
    run = subprocess.run([str(java), "-cp", str(libs / "*"), str(root / "RenderTemplate.java"), str(directory), template, str(output), title, description, str(details).lower()],text=True,capture_output=True)
    if run.returncode: raise RuntimeError(run.stderr)
    html = output.read_text(); assert html.strip(), "Empty rendered document"
    return Document(html)

def head_fragments(doc):
    return [n for n in doc.nodes if n["tag"] == "meta" and n["attrs"].get("name") == "dynamic-description" and "head" in n["ancestors"]]

cases = [("original", "Original title", "Original description", True), ("index", "Report <October>", "Detail & summary", True), ("index", "Second report", "Different detail", False)]
results=[]
for i,(template,title,description,details) in enumerate(cases):
    expected = render(probe/"src",template,rendered/f"source-{i}.html",title,description,details)
    actual = render(probe/"dist",template,rendered/f"fixed-{i}.html",title,description,details)
    assert head_fragments(expected), "Source fixture must exercise dynamic head fragment"
    assert expected.tokens == actual.tokens, f"Rendered structure differs for {template} / {details}"
    assert head_fragments(actual)[0]["attrs"]["content"] == description
    assert any(n["tag"] == "h1" and "body" in n["ancestors"] for n in actual.nodes)
    assert not any(n["tag"] == "th:block" for n in actual.nodes)
    if template == "index":
        ids = [n["attrs"].get("id") for n in actual.nodes]
        assert "prototype" in ids and "removed" not in ids
        assert ("conditional" in ids) == details
        assert "ordinary build comment" not in (probe/"dist/index.html").read_text()
        for n in actual.nodes:
            for key in ("src", "href"):
                url=n["attrs"].get(key,"")
                if url.endswith((".css", ".js")):
                    assert (probe/"dist"/url.lstrip("/")).is_file(), f"Missing asset {url}"
    results.append({"template":template,"details":details,"fullRenderedStructureMatched":True,"dynamicHeadFragment":True})

negatives=[]
for name in ("dist-default", "dist-no-optimize"):
    target=probe/name/"templates/fragments";target.mkdir(parents=True,exist_ok=True)
    shutil.copyfile(probe/"src/templates/fragments/common-head.html",target/"common-head.html")
    actual=render(probe/name,"original",rendered/(name+".html"),"Original title","Original description",True)
    assert not head_fragments(actual), f"Negative control unexpectedly contains head fragment: {name}"
    negatives.append({"variant":name,"dynamicFragmentInHead":False,"reproducesOriginalFailure":True})

result={"thymeleaf":"3.1.5.RELEASE","java":subprocess.run([java,"-version"], capture_output=True,text=True,check=True).stderr.splitlines()[0],"parcel":"2.16.4","cachedRebuildIdentical":True,"cases":results,"negativeControls":negatives,"mode":"Scripted actual Java template-engine rendering; no original-author adoption or human manual test"}
(root/"verification/results.json").write_text(json.dumps(result,indent=2)+"\n")
shutil.copyfile(rendered/"fixed-1.html",probe/"dist/rendered.html")
print(json.dumps(result,indent=2))
