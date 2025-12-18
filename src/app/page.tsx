"use client";

import { useMemo, useState } from "react";

type VariableMap = Record<string, string>;

type PackPrompt = {
  id: string;
  name: string;
  packName: string;
  goal: string;
  perImage: string;
  systemNotes: string;
};

const DEFAULT_META_PROMPT = `You are "Synthetic-Factory", a zero-GPU, CPU-only background service.
Your sole task: produce exactly {{count}} labelled synthetic images for {{pack_name}}.
Constraints:
- Never use real personal data.
- Output folder: {{output_path}}
- Label format: COCO-JSON + plain txt sidecar.
- Max resolution: 2K; file size < 300 KB.
- Randomisation seed = {{user_id}} * 997.
- Finish in < {{timeout}} seconds (CPU laptop level).
- Zip results and place a DONE.txt with MD5 hashes.
- Return only a JSON summary: {"status":"done","zip_size_MB":x,"file_count":y,"md5":"z"}

PACK-SPECIFIC ALT-PROMPTS (use when pack matches)`;

const DEFAULT_PACKS: PackPrompt[] = [
  {
    id: "tr_invoice",
    name: "Turkish Invoice Pack",
    packName: "TR_INVOICE",
    goal:
      "Synthetic finance documents mimicking Turkish invoices with anonymised merchant and buyer data.",
    perImage: [
      `header="FATURA" aligned to the top center`,
      "fields: vergi_no, fatura_no, tarih (DD.MM.YYYY), saat, kasa_id",
      "table rows with ürün_adı, adet, birim_fiyat, toplam",
      "QR code placeholder bottom right with caption 'E-Arşiv'",
      "stamp 'DİJİTAL KOPYA' diagonally semi-transparent",
    ].join("\n"),
    systemNotes:
      "Ensure totals are arithmetically consistent. Rotate 15% of samples by ±5° for scanner realism.",
  },
  {
    id: "us_id",
    name: "US ID Cards",
    packName: "US_ID_V1",
    goal:
      "Generate anonymised US-style identification cards with varied backgrounds and lighting.",
    perImage: [
      "front-and-back layout split horizontally",
      "fields: name, dob, issue_date, expiry_date, doc_number",
      "random portrait photo placeholder with coloured silhouette",
      "magnetic stripe or barcode on back with gibberish data",
    ].join("\n"),
    systemNotes:
      "Use lorem ipsum for text values. Render hologram overlays with subtle transparency.",
  },
  {
    id: "parking_tickets",
    name: "Parking Ticket Notices",
    packName: "PARKING_NOTICE_EU",
    goal:
      "Urban municipality parking violation notices in EU languages with unique ticket numbers.",
    perImage: [
      "municipality header with crest placeholder",
      "sections: offence_details, location, timestamp, fine_amount",
      "footer with payment instructions and IBAN style account numbers",
      "paper texture background with folds or creases",
    ].join("\n"),
    systemNotes:
      "Alternate languages (DE, FR, NL, IT). 20% should include overdue surcharge line item.",
  },
];

function normaliseKey(rawKey: string) {
  return rawKey.trim();
}

const PLACEHOLDER_REGEX = /{{\s*([^{}]+?)\s*}}/g;

function detectPlaceholders(prompt: string) {
  const keys = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = PLACEHOLDER_REGEX.exec(prompt)) !== null) {
    const key = normaliseKey(match[1]);
    if (key.length > 0) {
      keys.add(key);
    }
  }
  return Array.from(keys);
}

function injectVariables(template: string, values: VariableMap) {
  return template.replace(PLACEHOLDER_REGEX, (_, rawKey: string) => {
    const key = normaliseKey(rawKey);
    const value = values[key];
    return value !== undefined && value !== "" ? value : `{{${key}}}`;
  });
}

const DEFAULT_VARIABLES: VariableMap = {
  count: "24",
  pack_name: "TR_INVOICE",
  output_path: "/tmp/synthetic_factory/output",
  user_id: "142857",
  timeout: "45",
};

function packToMarkdown(pack: PackPrompt) {
  return [
    `Pack Name: ${pack.packName}`,
    `Objective: ${pack.goal}`,
    "",
    "Per Image Directives:",
    pack.perImage
      .split("\n")
      .map((line) => `- ${line}`)
      .join("\n"),
    "",
    `System Notes: ${pack.systemNotes}`,
  ].join("\n");
}

export default function Home() {
  const [metaPrompt, setMetaPrompt] = useState(DEFAULT_META_PROMPT);
  const [variables, setVariables] = useState<VariableMap>(DEFAULT_VARIABLES);
  const [packs, setPacks] = useState<PackPrompt[]>(DEFAULT_PACKS);
  const [selectedPackId, setSelectedPackId] = useState<string>(DEFAULT_PACKS[0]?.id ?? "");
  const [copied, setCopied] = useState<string | null>(null);

  const detectedVariables = useMemo(() => detectPlaceholders(metaPrompt), [metaPrompt]);

  const selectedPack = packs.find((pack) => pack.id === selectedPackId) ?? packs[0];

  const finalPrompt = useMemo(() => injectVariables(metaPrompt, variables), [metaPrompt, variables]);

  const combinedPrompt = useMemo(() => {
    if (!selectedPack) {
      return finalPrompt;
    }

    const divider = "\n\n---\n\n";
    return `${finalPrompt}${divider}${packToMarkdown(selectedPack)}`;
  }, [finalPrompt, selectedPack]);

  const handleVariableChange = (key: string, value: string) => {
    setVariables((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handlePackFieldChange = <K extends keyof PackPrompt>(field: K, value: PackPrompt[K]) => {
    setPacks((prev) =>
      prev.map((pack) => {
        if (pack.id === selectedPackId) {
          return {
            ...pack,
            [field]: value,
          };
        }
        return pack;
      }),
    );
    if (field === "packName") {
      handleVariableChange("pack_name", String(value));
    }
  };

  const handleSelectPack = (packId: string) => {
    setSelectedPackId(packId);
    const pack = packs.find((item) => item.id === packId);
    if (pack) {
      handleVariableChange("pack_name", pack.packName);
    }
  };

  const addNewPack = () => {
    const nextIndex = packs.length + 1;
    const newPack: PackPrompt = {
      id: `pack_${nextIndex}`,
      name: `New Pack ${nextIndex}`,
      packName: `PACK_${nextIndex}`,
      goal: "Describe the objective for this synthetic data pack.",
      perImage: "List per-image directives, each on its own line.",
      systemNotes: "Add advanced notes such as balancing rules or post-processing.",
    };
    setPacks((prev) => [...prev, newPack]);
    setSelectedPackId(newPack.id);
    handleVariableChange("pack_name", newPack.packName);
  };

  const copyToClipboard = async (label: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(null), 1800);
    } catch (error) {
      console.error("Clipboard copy failed", error);
      setCopied(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 pb-20 text-slate-200">
      <header className="border-b border-white/[0.08] bg-slate-950/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-6">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-slate-400">
              Synthetic Factory Control Surface
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-white">
              Meta Prompt Orchestrator
            </h1>
          </div>
          <button
            type="button"
            className="rounded-full border border-white/[0.12] px-4 py-2 text-sm font-medium text-slate-100 transition hover:border-teal-400 hover:text-teal-300"
            onClick={addNewPack}
          >
            + New Pack Variant
          </button>
        </div>
      </header>

      <main className="mx-auto mt-8 grid max-w-6xl gap-6 px-6 lg:grid-cols-[minmax(0,2fr),minmax(0,1.5fr)]">
        <section className="flex flex-col gap-6">
          <article className="rounded-2xl border border-white/[0.08] bg-slate-900/80 p-6 shadow-lg shadow-black/30">
            <header className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">Meta Prompt Blueprint</h2>
                <p className="text-sm text-slate-400">
                  Paste or refine your master controller prompt. Placeholders are captured
                  automatically.
                </p>
              </div>
              <button
                type="button"
                className="rounded-full border border-white/[0.12] px-3 py-1.5 text-xs font-medium text-slate-100 transition hover:border-teal-400 hover:text-teal-300"
                onClick={() => copyToClipboard("meta", metaPrompt)}
              >
                {copied === "meta" ? "Copied!" : "Copy"}
              </button>
            </header>
            <textarea
              className="mt-4 h-72 w-full resize-none rounded-xl border border-white/[0.06] bg-slate-950/60 px-4 py-3 text-sm leading-6 text-slate-100 shadow-inner shadow-black/40 outline-none ring-1 ring-black/40 transition focus:border-teal-400 focus:ring-teal-500"
              value={metaPrompt}
              onChange={(event) => setMetaPrompt(event.target.value)}
            />
            <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-400">
              {detectedVariables.map((variable) => (
                <span
                  key={variable}
                  className="rounded-full border border-teal-500/60 bg-teal-500/10 px-3 py-1 font-mono text-[13px] text-teal-200"
                >
                  {`{{${variable}}}`}
                </span>
              ))}
            </div>
          </article>

          <article className="rounded-2xl border border-white/[0.08] bg-slate-900/80 p-6 shadow-lg shadow-black/30">
            <header className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">Pack Library</h2>
                <p className="text-sm text-slate-400">
                  Align runtime directives for each synthetic data pack variant.
                </p>
              </div>
            </header>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {packs.map((pack) => {
                const isActive = pack.id === selectedPackId;
                return (
                  <button
                    key={pack.id}
                    type="button"
                    onClick={() => handleSelectPack(pack.id)}
                    className={`flex h-full flex-col rounded-2xl border px-5 py-4 text-left transition ${
                      isActive
                        ? "border-teal-400/80 bg-teal-500/10"
                        : "border-white/[0.05] bg-slate-950/40 hover:border-white/[0.12]"
                    }`}
                  >
                    <span className="text-sm font-semibold uppercase tracking-wide text-teal-200">
                      {pack.packName}
                    </span>
                    <span className="mt-1 text-lg font-semibold text-white">{pack.name}</span>
                    <span className="mt-2 line-clamp-3 text-sm text-slate-400">
                      {pack.goal}
                    </span>
                  </button>
                );
              })}
            </div>

            {selectedPack && (
              <div className="mt-6 space-y-4">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                  Active Pack Blueprint
                </h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="flex flex-col gap-2 text-sm text-slate-300">
                    Display Name
                    <input
                      className="rounded-xl border border-white/[0.08] bg-slate-950/50 px-4 py-2 text-sm text-slate-100 outline-none transition focus:border-teal-400 focus:ring-2 focus:ring-teal-500/50"
                      value={selectedPack.name}
                      onChange={(event) => handlePackFieldChange("name", event.target.value)}
                    />
                  </label>
                  <label className="flex flex-col gap-2 text-sm text-slate-300">
                    Pack Identifier
                    <input
                      className="rounded-xl border border-white/[0.08] bg-slate-950/50 px-4 py-2 text-sm text-slate-100 outline-none transition focus:border-teal-400 focus:ring-2 focus:ring-teal-500/50"
                      value={selectedPack.packName}
                      onChange={(event) => handlePackFieldChange("packName", event.target.value)}
                    />
                  </label>
                </div>
                <label className="flex flex-col gap-2 text-sm text-slate-300">
                  Generation Objective
                  <textarea
                    className="min-h-[96px] rounded-xl border border-white/[0.08] bg-slate-950/50 px-4 py-2 text-sm text-slate-100 outline-none transition focus:border-teal-400 focus:ring-2 focus:ring-teal-500/50"
                    value={selectedPack.goal}
                    onChange={(event) => handlePackFieldChange("goal", event.target.value)}
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm text-slate-300">
                  Per Image Directives (one per line)
                  <textarea
                    className="min-h-[140px] rounded-xl border border-white/[0.08] bg-slate-950/50 px-4 py-2 text-sm text-slate-100 outline-none transition focus:border-teal-400 focus:ring-2 focus:ring-teal-500/50"
                    value={selectedPack.perImage}
                    onChange={(event) => handlePackFieldChange("perImage", event.target.value)}
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm text-slate-300">
                  System Notes
                  <textarea
                    className="min-h-[110px] rounded-xl border border-white/[0.08] bg-slate-950/50 px-4 py-2 text-sm text-slate-100 outline-none transition focus:border-teal-400 focus:ring-2 focus:ring-teal-500/50"
                    value={selectedPack.systemNotes}
                    onChange={(event) => handlePackFieldChange("systemNotes", event.target.value)}
                  />
                </label>
                <div className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-slate-950/40 px-4 py-3 text-xs text-slate-400">
                  <span>Sync pack identifier with meta prompt placeholder.</span>
                  <button
                    type="button"
                    className="rounded-full border border-white/[0.12] px-3 py-1.5 text-xs font-medium text-slate-100 transition hover:border-teal-400 hover:text-teal-300"
                    onClick={() =>
                      handleVariableChange("pack_name", selectedPack.packName || variables.pack_name)
                    }
                  >
                    Apply
                  </button>
                </div>
              </div>
            )}
          </article>
        </section>

        <section className="flex flex-col gap-6">
          <article className="rounded-2xl border border-white/[0.08] bg-slate-900/80 p-6 shadow-lg shadow-black/30">
            <header className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">Runtime Variables</h2>
                <p className="text-sm text-slate-400">
                  Populate placeholders that get injected before dispatching the job.
                </p>
              </div>
            </header>
            <div className="mt-6 space-y-3">
              {detectedVariables.length === 0 && (
                <p className="text-sm text-slate-400">
                  No placeholders detected. Use the pattern <code>{"{{variable}}"}</code> inside the
                  meta prompt.
                </p>
              )}
              {detectedVariables.map((variable) => (
                <label key={variable} className="flex flex-col gap-2 text-sm text-slate-300">
                  <span className="flex items-center justify-between">
                    <span className="font-medium text-slate-100">{variable}</span>
                    <span className="font-mono text-xs text-slate-500">{`{{${variable}}}`}</span>
                  </span>
                  <input
                    className="rounded-xl border border-white/[0.08] bg-slate-950/50 px-4 py-2 text-sm text-slate-100 outline-none transition focus:border-teal-400 focus:ring-2 focus:ring-teal-500/50"
                    value={variables[variable] ?? ""}
                    onChange={(event) => handleVariableChange(variable, event.target.value)}
                  />
                </label>
              ))}
            </div>
          </article>

          <article className="rounded-2xl border border-teal-500/20 bg-slate-900/90 p-6 shadow-[0_20px_40px_-20px_rgba(20,184,166,0.45)]">
            <header className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-teal-200">Dispatch Packet</h2>
                <p className="text-sm text-slate-400">
                  Final controller prompt merged with active pack directives.
                </p>
              </div>
              <button
                type="button"
                className="rounded-full border border-teal-400/60 px-3 py-1.5 text-xs font-medium text-teal-200 transition hover:border-teal-200 hover:text-teal-100"
                onClick={() => copyToClipboard("dispatch", combinedPrompt)}
              >
                {copied === "dispatch" ? "Copied!" : "Copy"}
              </button>
            </header>
            <pre className="mt-4 max-h-[420px] overflow-auto rounded-xl border border-white/[0.05] bg-slate-950/70 px-5 py-4 text-xs leading-6 text-slate-100">
              {combinedPrompt}
            </pre>
          </article>

          <article className="rounded-2xl border border-white/[0.08] bg-slate-900/80 p-6 shadow-lg shadow-black/30">
            <header>
              <h2 className="text-lg font-semibold text-white">Automation Payload</h2>
              <p className="text-sm text-slate-400">
                Export a JSON config for headless execution pipelines.
              </p>
            </header>
            <button
              type="button"
              className="mt-4 w-full rounded-xl border border-white/[0.12] bg-slate-950/50 px-4 py-2 text-sm font-medium text-slate-100 transition hover:border-teal-400 hover:text-teal-200"
              onClick={() =>
                copyToClipboard(
                  "json",
                  JSON.stringify(
                    {
                      metaPrompt: finalPrompt,
                      selectedPack: selectedPack
                        ? {
                            packName: selectedPack.packName,
                            goal: selectedPack.goal,
                            perImage: selectedPack.perImage.split("\n").map((line) => line.trim()),
                            systemNotes: selectedPack.systemNotes,
                          }
                        : null,
                      variables,
                    },
                    null,
                    2,
                  ),
                )
              }
            >
              {copied === "json" ? "Copied!" : "Copy JSON Snapshot"}
            </button>
          </article>
        </section>
      </main>
    </div>
  );
}
