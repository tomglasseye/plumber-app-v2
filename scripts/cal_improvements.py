import sys
sys.stdout.reconfigure(encoding='utf-8')
with open('src/pages/CalendarPage.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

results = []

# ── 1. ptrDragRef colRects type: add engineerId ──────────────────────────────
old = (
    '\t\tcolRects: Array<{\n'
    '\t\t\tds: string;\n'
    '\t\t\tleft: number;\n'
    '\t\t\tright: number;\n'
    '\t\t\ttop: number;\n'
    '\t\t}>;\n'
)
new = (
    '\t\tcolRects: Array<{\n'
    '\t\t\tds: string;\n'
    '\t\t\tengineerId?: string;\n'
    '\t\t\tleft: number;\n'
    '\t\t\tright: number;\n'
    '\t\t\ttop: number;\n'
    '\t\t}>;\n'
)
results.append(('ptrDragRef type', old in content))
content = content.replace(old, new, 1)

# ── 2. onJobPtrDown: capture engineerId in colRects ──────────────────────────
old = (
    '\t\tconst colRects = cols.map((col) => {\n'
    '\t\t\tconst r = col.getBoundingClientRect();\n'
    '\t\t\treturn {\n'
    '\t\t\t\tds: col.getAttribute("data-ds")!,\n'
    '\t\t\t\tleft: r.left,\n'
    '\t\t\t\tright: r.right,\n'
    '\t\t\t\ttop: r.top,\n'
    '\t\t\t};\n'
    '\t\t});\n'
)
new = (
    '\t\tconst colRects = cols.map((col) => {\n'
    '\t\t\tconst r = col.getBoundingClientRect();\n'
    '\t\t\treturn {\n'
    '\t\t\t\tds: col.getAttribute("data-ds")!,\n'
    '\t\t\t\tengineerId: col.getAttribute("data-engineer-id") ?? undefined,\n'
    '\t\t\t\tleft: r.left,\n'
    '\t\t\t\tright: r.right,\n'
    '\t\t\t\ttop: r.top,\n'
    '\t\t\t};\n'
    '\t\t});\n'
)
results.append(('onJobPtrDown colRects', old in content))
content = content.replace(old, new, 1)

# ── 3. onJobPtrUp: pass assignedTo when engineer changes ────────────────────
old = (
    '\t\t\t\t\trescheduleJob(\n'
    '\t\t\t\t\t\tpd.jobId,\n'
    '\t\t\t\t\t\ttargetCol.ds,\n'
    '\t\t\t\t\t\ttime,\n'
    '\t\t\t\t\t\tminutesToTime(timeToMinutes(time) + dur),\n'
    '\t\t\t\t\t);\n'
)
new = (
    '\t\t\t\t\tconst newEngineer =\n'
    '\t\t\t\t\t\ttargetCol.engineerId &&\n'
    '\t\t\t\t\t\ttargetCol.engineerId !== job?.assignedTo\n'
    '\t\t\t\t\t\t\t? targetCol.engineerId\n'
    '\t\t\t\t\t\t\t: undefined;\n'
    '\t\t\t\t\trescheduleJob(\n'
    '\t\t\t\t\t\tpd.jobId,\n'
    '\t\t\t\t\t\ttargetCol.ds,\n'
    '\t\t\t\t\t\ttime,\n'
    '\t\t\t\t\t\tminutesToTime(timeToMinutes(time) + dur),\n'
    '\t\t\t\t\t\tnewEngineer,\n'
    '\t\t\t\t\t);\n'
)
results.append(('onJobPtrUp assignedTo', old in content))
content = content.replace(old, new, 1)

# ── 4. JobPopover: add changeStatus import + status buttons ──────────────────
# Add changeStatus to the useApp destructure inside JobPopover
old = '\t\tconst job = jobs.find((j) => j.id === jobId);\n\t\tif (!job) return null;\n\t\tconst engineer = users.find((u) => u.id === job.assignedTo);\n'
new = '\t\tconst { changeStatus } = useApp();\n\t\tconst job = jobs.find((j) => j.id === jobId);\n\t\tif (!job) return null;\n\t\tconst engineer = users.find((u) => u.id === job.assignedTo);\n'
results.append(('JobPopover changeStatus import', old in content))
content = content.replace(old, new, 1)

# Add status buttons before the "View Full Details" button
old = (
    '\t\t\t\t<div className="px-4 pb-3">\n'
    '\t\t\t\t\t<button\n'
    '\t\t\t\t\t\tonClick={() => {\n'
    '\t\t\t\t\t\t\tonClose();\n'
    '\t\t\t\t\t\t\tnavigate(`/job/${jobId}`);\n'
    '\t\t\t\t\t\t}}\n'
    '\t\t\t\t\t\tclassName="w-full rounded-lg py-2 text-xs font-medium text-white cursor-pointer hover:opacity-90 transition-opacity"\n'
    '\t\t\t\t\t\tstyle={{ background: business.accentColor }}\n'
    '\t\t\t\t\t>\n'
    '\t\t\t\t\t\tView Full Details \u2192\n'
    '\t\t\t\t\t</button>\n'
    '\t\t\t\t</div>\n'
)
new = (
    '\t\t\t\t<div className="px-4 pb-2">\n'
    '\t\t\t\t\t<p className="text-[9px] uppercase tracking-wider text-neutral-600 mb-1.5">Status</p>\n'
    '\t\t\t\t\t<div className="flex flex-wrap gap-1">\n'
    '\t\t\t\t\t\t{(["Scheduled","En Route","On Site","Completed","Invoiced"] as const).map((s) => {\n'
    '\t\t\t\t\t\t\tconst isCurrent = job.status === s;\n'
    '\t\t\t\t\t\t\tconst sc = STATUS_COLORS[s];\n'
    '\t\t\t\t\t\t\treturn (\n'
    '\t\t\t\t\t\t\t\t<button\n'
    '\t\t\t\t\t\t\t\t\tkey={s}\n'
    '\t\t\t\t\t\t\t\t\tonClick={() => { changeStatus(job.id, s); if (isCurrent) return; }}\n'
    '\t\t\t\t\t\t\t\t\tclassName={`rounded px-2 py-1 text-[10px] font-medium cursor-pointer transition-opacity hover:opacity-80 ${sc.bg} ${sc.text} ${isCurrent ? "ring-1 ring-white/40" : "opacity-60"}`}\n'
    '\t\t\t\t\t\t\t\t>\n'
    '\t\t\t\t\t\t\t\t\t{s}\n'
    '\t\t\t\t\t\t\t\t</button>\n'
    '\t\t\t\t\t\t\t);\n'
    '\t\t\t\t\t\t})}\n'
    '\t\t\t\t\t</div>\n'
    '\t\t\t\t</div>\n'
    '\t\t\t\t<div className="px-4 pb-3">\n'
    '\t\t\t\t\t<button\n'
    '\t\t\t\t\t\tonClick={() => {\n'
    '\t\t\t\t\t\t\tonClose();\n'
    '\t\t\t\t\t\t\tnavigate(`/job/${jobId}`);\n'
    '\t\t\t\t\t\t}}\n'
    '\t\t\t\t\t\tclassName="w-full rounded-lg py-2 text-xs font-medium text-white cursor-pointer hover:opacity-90 transition-opacity"\n'
    '\t\t\t\t\t\tstyle={{ background: business.accentColor }}\n'
    '\t\t\t\t\t>\n'
    '\t\t\t\t\t\tView Full Details \u2192\n'
    '\t\t\t\t\t</button>\n'
    '\t\t\t\t</div>\n'
)
results.append(('JobPopover status buttons', old in content))
content = content.replace(old, new, 1)

# ── 5. DayColumn: working hours shading ─────────────────────────────────────
# Add shading after the hour lines section in DayColumn
old = '\t\t\t{/* Holiday blocks \u2014 positioned within working hours */}'
new = (
    '\t\t\t{/* Working hours shading */}\n'
    '\t\t\t{workDayStart > HOUR_START && (\n'
    '\t\t\t\t<div\n'
    '\t\t\t\t\tstyle={{ position: "absolute", top: 0, left: 0, right: 0, height: timeToY(`${String(workDayStart).padStart(2,"0")}:00`), zIndex: 0, pointerEvents: "none" }}\n'
    '\t\t\t\t\tclassName="bg-neutral-950/50"\n'
    '\t\t\t\t/>\n'
    '\t\t\t)}\n'
    '\t\t\t{workDayEnd < HOUR_END && (\n'
    '\t\t\t\t<div\n'
    '\t\t\t\t\tstyle={{ position: "absolute", top: timeToY(`${String(workDayEnd).padStart(2,"0")}:00`), left: 0, right: 0, bottom: 0, height: TOTAL_HEIGHT - timeToY(`${String(workDayEnd).padStart(2,"0")}:00`), zIndex: 0, pointerEvents: "none" }}\n'
    '\t\t\t\t\tclassName="bg-neutral-950/50"\n'
    '\t\t\t\t/>\n'
    '\t\t\t)}\n'
    '\t\t\t{/* Holiday blocks \u2014 positioned within working hours */}'
)
results.append(('DayColumn working hours shading', old in content))
content = content.replace(old, new, 1)

# ── 6. DayView: wire refs, data-engineer-id, working hours shading, drag ────
# 6a. Replace bodyScrollRef2 with gridScrollRef on the scroll container
#     and hdrRef2 onScroll to use gridScrollRef
old = (
    '\t\t\t\t<div\n'
    '\t\t\t\t\tref={bodyScrollRef2}\n'
    '\t\t\t\t\tclassName="overflow-auto"\n'
    '\t\t\t\t\tstyle={{ maxHeight: "calc(100vh - 340px)", minHeight: 400 }}\n'
    '\t\t\t\t\tonScroll={() => {\n'
    '\t\t\t\t\t\tif (hdrRef2.current && bodyScrollRef2.current) {\n'
    '\t\t\t\t\t\t\thdrRef2.current.scrollLeft = bodyScrollRef2.current.scrollLeft;\n'
    '\t\t\t\t\t\t}\n'
    '\t\t\t\t\t}}\n'
    '\t\t\t\t>'
)
new = (
    '\t\t\t\t<div\n'
    '\t\t\t\t\tref={gridScrollRef}\n'
    '\t\t\t\t\tclassName="overflow-auto"\n'
    '\t\t\t\t\tstyle={{ maxHeight: "calc(100vh - 340px)", minHeight: 400 }}\n'
    '\t\t\t\t\tonScroll={() => {\n'
    '\t\t\t\t\t\tif (hdrRef2.current && gridScrollRef.current) {\n'
    '\t\t\t\t\t\t\thdrRef2.current.scrollLeft = gridScrollRef.current.scrollLeft;\n'
    '\t\t\t\t\t\t}\n'
    '\t\t\t\t\t}}\n'
    '\t\t\t\t>'
)
results.append(('DayView gridScrollRef', old in content))
content = content.replace(old, new, 1)

# 6b. Add ref={gridBodyRef} to the flex container in DayView
old = (
    '\t\t\t\t\t<div\n'
    '\t\t\t\t\t\tclassName="flex"\n'
    '\t\t\t\t\t\tstyle={{ height: TOTAL_HEIGHT, minWidth: showList.length * COL_W + GUTTER_W }}\n'
    '\t\t\t\t\t>'
)
new = (
    '\t\t\t\t\t<div\n'
    '\t\t\t\t\t\tref={gridBodyRef}\n'
    '\t\t\t\t\t\tclassName="flex"\n'
    '\t\t\t\t\t\tstyle={{ height: TOTAL_HEIGHT, minWidth: showList.length * COL_W + GUTTER_W }}\n'
    '\t\t\t\t\t>'
)
results.append(('DayView gridBodyRef', old in content))
content = content.replace(old, new, 1)

# 6c. Add data-engineer-id, working hours shading, and onDragOver/onDrop to DayView engineer columns
old = (
    '\t\t\t\t\t\t\t<div\n'
    '\t\t\t\t\t\t\t\tkey={eng.id}\n'
    '\t\t\t\t\t\t\t\tdata-ds={ds}\n'
    '\t\t\t\t\t\t\t\tstyle={{ width: COL_W, flexShrink: 0, position: "relative", height: TOTAL_HEIGHT, cursor: "crosshair" }}\n'
    '\t\t\t\t\t\t\t\tclassName="border-r border-neutral-800"\n'
    '\t\t\t\t\t\t\t\tonClick={(e) => {\n'
    '\t\t\t\t\t\t\t\t\tconst rect = e.currentTarget.getBoundingClientRect();\n'
    '\t\t\t\t\t\t\t\t\tconst scrollTop = bodyScrollRef2.current?.scrollTop ?? 0;\n'
    '\t\t\t\t\t\t\t\t\tconst time = yToTime(e.clientY - rect.top + scrollTop);\n'
    '\t\t\t\t\t\t\t\t\topenAddPanel({\n'
    '\t\t\t\t\t\t\t\t\t\tdate: ds,\n'
    '\t\t\t\t\t\t\t\t\t\tassignedTo: eng.id,\n'
    '\t\t\t\t\t\t\t\t\t\tstartTime: time,\n'
    '\t\t\t\t\t\t\t\t\t\tendTime: minutesToTime(timeToMinutes(time) + 60),\n'
    '\t\t\t\t\t\t\t\t\t});\n'
    '\t\t\t\t\t\t\t\t}}\n'
    '\t\t\t\t\t\t\t>'
)
new = (
    '\t\t\t\t\t\t\t<div\n'
    '\t\t\t\t\t\t\t\tkey={eng.id}\n'
    '\t\t\t\t\t\t\t\tdata-ds={ds}\n'
    '\t\t\t\t\t\t\t\tdata-engineer-id={eng.id}\n'
    '\t\t\t\t\t\t\t\tstyle={{ width: COL_W, flexShrink: 0, position: "relative", height: TOTAL_HEIGHT, cursor: "crosshair" }}\n'
    '\t\t\t\t\t\t\t\tclassName="border-r border-neutral-800"\n'
    '\t\t\t\t\t\t\t\tonDragOver={(e) => {\n'
    '\t\t\t\t\t\t\t\t\tif (e.dataTransfer.types.includes("unscheduledjobid")) e.preventDefault();\n'
    '\t\t\t\t\t\t\t\t}}\n'
    '\t\t\t\t\t\t\t\tonDrop={(e) => {\n'
    '\t\t\t\t\t\t\t\t\tconst jobId = e.dataTransfer.getData("unscheduledJobId");\n'
    '\t\t\t\t\t\t\t\t\tif (!jobId) return;\n'
    '\t\t\t\t\t\t\t\t\te.preventDefault();\n'
    '\t\t\t\t\t\t\t\t\tconst rect = e.currentTarget.getBoundingClientRect();\n'
    '\t\t\t\t\t\t\t\t\tconst scrollTop = gridScrollRef.current?.scrollTop ?? 0;\n'
    '\t\t\t\t\t\t\t\t\tconst startTime = yToTime(e.clientY - rect.top + scrollTop);\n'
    '\t\t\t\t\t\t\t\t\trescheduleJob(jobId, ds, startTime, minutesToTime(timeToMinutes(startTime) + 60), eng.id);\n'
    '\t\t\t\t\t\t\t\t}}\n'
    '\t\t\t\t\t\t\t\tonClick={(e) => {\n'
    '\t\t\t\t\t\t\t\t\tconst rect = e.currentTarget.getBoundingClientRect();\n'
    '\t\t\t\t\t\t\t\t\tconst scrollTop = gridScrollRef.current?.scrollTop ?? 0;\n'
    '\t\t\t\t\t\t\t\t\tconst time = yToTime(e.clientY - rect.top + scrollTop);\n'
    '\t\t\t\t\t\t\t\t\topenAddPanel({\n'
    '\t\t\t\t\t\t\t\t\t\tdate: ds,\n'
    '\t\t\t\t\t\t\t\t\t\tassignedTo: eng.id,\n'
    '\t\t\t\t\t\t\t\t\t\tstartTime: time,\n'
    '\t\t\t\t\t\t\t\t\t\tendTime: minutesToTime(timeToMinutes(time) + 60),\n'
    '\t\t\t\t\t\t\t\t\t});\n'
    '\t\t\t\t\t\t\t\t}}\n'
    '\t\t\t\t\t\t\t>'
)
results.append(('DayView column attrs + drag', old in content))
content = content.replace(old, new, 1)

# 6d. Working hours shading in DayView columns (after hour grid lines, before holidays)
old = (
    '\t\t\t\t\t\t\t\t\t{engHols.map((h) => {\n'
    '\t\t\t\t\t\t\t\t\t\tconst cfg = HOLIDAY_TYPE_CONFIG[h.type];\n'
    '\t\t\t\t\t\t\t\t\t\tconst blockTop = timeToY(wds);\n'
    '\t\t\t\t\t\t\t\t\t\tconst fullH = (business.workDayEnd - business.workDayStart) * HOUR_HEIGHT;\n'
    '\t\t\t\t\t\t\t\t\t\tconst blockH = h.halfDay ? fullH / 2 : fullH;\n'
    '\t\t\t\t\t\t\t\t\t\treturn (\n'
    '\t\t\t\t\t\t\t\t\t\t\t<div\n'
    '\t\t\t\t\t\t\t\t\t\t\t\tkey={h.id}\n'
    '\t\t\t\t\t\t\t\t\t\t\t\tstyle={{ position: "absolute", top: blockTop, left: 0, right: 0, height: blockH, zIndex: 1 }}\n'
    '\t\t\t\t\t\t\t\t\t\t\t\tclassName={`${cfg.bg} opacity-70 flex items-center justify-center`}\n'
    '\t\t\t\t\t\t\t\t\t\t\t\tonClick={(e) => { e.stopPropagation(); if (isMaster) openEditHoliday(h); }}\n'
)
new = (
    '\t\t\t\t\t\t\t\t\t{/* Working hours shading */}\n'
    '\t\t\t\t\t\t\t\t\t{business.workDayStart > HOUR_START && (\n'
    '\t\t\t\t\t\t\t\t\t\t<div style={{ position: "absolute", top: 0, left: 0, right: 0, height: timeToY(wds), zIndex: 0, pointerEvents: "none" }} className="bg-neutral-950/50" />\n'
    '\t\t\t\t\t\t\t\t\t)}\n'
    '\t\t\t\t\t\t\t\t\t{business.workDayEnd < HOUR_END && (\n'
    '\t\t\t\t\t\t\t\t\t\t<div style={{ position: "absolute", top: timeToY(`${String(business.workDayEnd).padStart(2,"0")}:00`), left: 0, right: 0, height: TOTAL_HEIGHT - timeToY(`${String(business.workDayEnd).padStart(2,"0")}:00`), zIndex: 0, pointerEvents: "none" }} className="bg-neutral-950/50" />\n'
    '\t\t\t\t\t\t\t\t\t)}\n'
    '\t\t\t\t\t\t\t\t\t{engHols.map((h) => {\n'
    '\t\t\t\t\t\t\t\t\t\tconst cfg = HOLIDAY_TYPE_CONFIG[h.type];\n'
    '\t\t\t\t\t\t\t\t\t\tconst blockTop = timeToY(wds);\n'
    '\t\t\t\t\t\t\t\t\t\tconst fullH = (business.workDayEnd - business.workDayStart) * HOUR_HEIGHT;\n'
    '\t\t\t\t\t\t\t\t\t\tconst blockH = h.halfDay ? fullH / 2 : fullH;\n'
    '\t\t\t\t\t\t\t\t\t\treturn (\n'
    '\t\t\t\t\t\t\t\t\t\t\t<div\n'
    '\t\t\t\t\t\t\t\t\t\t\t\tkey={h.id}\n'
    '\t\t\t\t\t\t\t\t\t\t\t\tstyle={{ position: "absolute", top: blockTop, left: 0, right: 0, height: blockH, zIndex: 1 }}\n'
    '\t\t\t\t\t\t\t\t\t\t\t\tclassName={`${cfg.bg} opacity-70 flex items-center justify-center`}\n'
    '\t\t\t\t\t\t\t\t\t\t\t\tonClick={(e) => { e.stopPropagation(); if (isMaster) openEditHoliday(h); }}\n'
)
results.append(('DayView working hours shading', old in content))
content = content.replace(old, new, 1)

# Print results
for name, found in results:
    print(f'{"OK" if found else "MISS"}: {name}')

with open('src/pages/CalendarPage.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print('Done')
