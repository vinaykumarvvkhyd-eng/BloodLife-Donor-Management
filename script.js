'use strict';

const GROUPS = ['A+','A-','B+','B-','AB+','AB-','O+','O-'];
const COLORS = ['#e54858','#f08a94','#ed8750','#f2b75f','#806bd0','#aa9be5','#259b81','#78c9ae'];
const STORAGE_KEY = 'lifedrop_donors';
const $ = id => document.getElementById(id);
let donors = loadDonors();
let bloodChart = null;
let analyticsChart = null;
let toastTimer;

function loadDonors(){
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(raw) ? raw.filter(d => d && d.name && d.phone && GROUPS.includes(d.bloodGroup)).map(d => ({
      id: String(d.id || Date.now() + Math.random()), name: String(d.name), phone: String(d.phone),
      email: String(d.email || ''), age: Number(d.age), gender: String(d.gender || ''),
      bloodGroup: String(d.bloodGroup), city: String(d.city || ''), address: String(d.address || ''),
      lastDonation: String(d.lastDonation || ''), registeredAt: d.registeredAt || new Date().toISOString()
    })) : [];
  } catch(error) { console.warn('Could not read saved donor data:', error); return []; }
}
function saveData(){
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(donors)); return true; }
  catch(error){ notify('Storage is full or unavailable. Export a backup before continuing.'); return false; }
}
function escapeHTML(value){return String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));}
function initials(name){return String(name||'D').trim().split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase();}
function notify(message){const toast=$('toast');toast.textContent=message;toast.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove('show'),2800);}

const pageInfo={dashboard:['Overview','Your community, connected'],register:['Register donor','Add a new volunteer'],donors:['Donor directory','Search and manage donor records'],analytics:['Insights & reports','Understand your donor community']};
function showSection(section){
  if(!pageInfo[section]) section='dashboard';
  document.querySelectorAll('.page-section').forEach(s=>s.classList.toggle('active',s.id===section));
  document.querySelectorAll('.nav-link').forEach(a=>a.classList.toggle('active',a.dataset.section===section));
  $('pageTitle').textContent=pageInfo[section][0];
  document.title=`${pageInfo[section][0]} | LifeDrop`;
  history.replaceState(null,'','#'+section);
  $('sidebar').classList.remove('open');
  refreshDashboard();
  if(section==='analytics') setTimeout(()=>renderCharts(getBloodCounts()),60);
}
document.querySelectorAll('.nav-link').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();showSection(a.dataset.section);}));
$('mobileMenu').addEventListener('click',()=>$('sidebar').classList.toggle('open'));
document.addEventListener('click',e=>{if(window.innerWidth<=900&&!$('sidebar').contains(e.target)&&!$('mobileMenu').contains(e.target))$('sidebar').classList.remove('open');});

// Preliminary screening only. Medical staff must make the actual decision.
function getEligibility(donor){
  const age=Number(donor.age);
  if(age<18||age>65)return false;
  if(donor.lastDonation){
    const last=new Date(donor.lastDonation+'T00:00:00');
    const today=new Date();today.setHours(0,0,0,0);
    const days=Math.floor((today-last)/86400000);
    if(!Number.isFinite(days)||days<90)return false;
  }
  return true;
}
function statusHTML(d){const ok=getEligibility(d);return `<span class="status-badge ${ok?'eligible':'pending'}">${ok?'Screening passed*':'Needs review'}</span>`;}
function getBloodCounts(){return Object.fromEntries(GROUPS.map(g=>[g,donors.filter(d=>d.bloodGroup===g).length]));}

// Registration and validation
$('lastDonation').max=new Date().toISOString().slice(0,10);
$('donorForm').addEventListener('submit',function(e){
  e.preventDefault();
  const name=$('name').value.trim(),phone=$('phone').value.trim(),email=$('email').value.trim();
  const age=Number($('age').value),gender=$('gender').value,bloodGroup=$('bloodGroup').value;
  const city=$('city').value.trim(),address=$('address').value.trim(),lastDonation=$('lastDonation').value;
  if(!/^[A-Za-z\s.'-]{2,60}$/.test(name))return notify('Enter a valid name using at least 2 letters.');
  if(!/^[6-9]\d{9}$/.test(phone))return notify('Enter a valid 10-digit Indian mobile number.');
  if(donors.some(d=>d.phone===phone))return notify('This mobile number is already registered.');
  if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return notify('Enter a valid email address.');
  if(!Number.isInteger(age)||age<18||age>65)return notify('For this project, donor age must be between 18 and 65.');
  if(!GROUPS.includes(bloodGroup))return notify('Please select a valid blood group.');
  if(!gender)return notify('Please select gender.');
  if(!/^[A-Za-z\s.'-]{2,60}$/.test(city))return notify('Enter a valid city name.');
  if(!address)return notify('Please enter the donor address.');
  if(lastDonation&&new Date(lastDonation+'T00:00:00')>new Date(new Date().toDateString()))return notify('Last donation date cannot be in the future.');
  if(!$('consent').checked)return notify('Please confirm donor consent before saving.');
  const donor={id:(crypto.randomUUID?crypto.randomUUID():Date.now().toString()),name,phone,email,age,gender,bloodGroup,city,address,lastDonation,registeredAt:new Date().toISOString()};
  donors.unshift(donor);
  if(!saveData()){donors.shift();return;}
  this.reset();$('lastDonation').max=new Date().toISOString().slice(0,10);$('formMessage').textContent='✓ Donor profile saved successfully.';
  notify('Donor registered successfully.');refreshDashboard();showSection('donors');
});
$('donorForm').addEventListener('reset',()=>setTimeout(()=>$('formMessage').textContent='',0));

function renderBloodSummary(counts){
  $('bloodSummary').innerHTML=GROUPS.map((g,i)=>`<div class="blood-item"><span class="blood-type">${g}</span><span class="blood-count">${counts[g]}</span></div>`).join('');
  $('chartLegend').innerHTML=GROUPS.map((g,i)=>`<span class="legend-item"><i style="background:${COLORS[i]}"></i>${g}</span>`).join('');
}
function donorCell(d){return `<div class="donor-cell"><span class="donor-avatar">${escapeHTML(initials(d.name))}</span><strong>${escapeHTML(d.name)}</strong></div>`;}
function renderRecentDonors(){
  const recent=donors.slice(0,5);
  $('recentTable').innerHTML=recent.length?recent.map(d=>`<tr><td>${donorCell(d)}</td><td>${escapeHTML(d.phone)}</td><td><span class="blood-tag">${escapeHTML(d.bloodGroup)}</span></td><td>${Number(d.age)}</td><td>${statusHTML(d)}</td></tr>`).join(''):`<tr><td colspan="5" class="muted">No donors registered yet. Add your first donor to get started.</td></tr>`;
}
function renderDonorTable(){
  const search=$('searchInput').value.toLowerCase().trim(),filter=$('filterBlood').value;
  const filtered=donors.filter(d=>[d.name,d.phone,d.city,d.email].some(v=>String(v||'').toLowerCase().includes(search))&&(!filter||d.bloodGroup===filter));
  $('donorTable').innerHTML=filtered.map(d=>`<tr><td>${donorCell(d)}</td><td><strong>${escapeHTML(d.phone)}</strong><br><span class="muted">${escapeHTML(d.email||'No email')}</span></td><td><span class="blood-tag">${escapeHTML(d.bloodGroup)}</span></td><td>${Number(d.age)}</td><td>${escapeHTML(d.city)}</td><td>${statusHTML(d)}</td><td><div class="action-group"><button class="action-btn" onclick="viewDonor('${encodeURIComponent(d.id)}')">View</button><button class="action-btn delete" onclick="deleteDonor('${encodeURIComponent(d.id)}')">Delete</button></div></td></tr>`).join('');
  $('recordCount').textContent=`${filtered.length} of ${donors.length} donor record${donors.length===1?'':'s'}`;
  $('emptyHint').hidden=filtered.length!==0;
  document.querySelector('.directory-card .table-scroll').style.display=filtered.length?'block':'none';
}
$('searchInput').addEventListener('input',renderDonorTable);$('filterBlood').addEventListener('change',renderDonorTable);
function viewDonor(encodedId){const id=decodeURIComponent(encodedId);const d=donors.find(x=>x.id===id);if(!d)return;alert(`DONOR PROFILE\n\nName: ${d.name}\nPhone: ${d.phone}\nEmail: ${d.email||'Not provided'}\nBlood group: ${d.bloodGroup}\nAge: ${d.age}\nGender: ${d.gender}\nCity: ${d.city}\nAddress: ${d.address}\nLast donation: ${d.lastDonation||'Not provided'}\nScreening: ${getEligibility(d)?'Passed preliminary software check':'Needs review'}\n\nNote: This is not medical clearance.`);}
function deleteDonor(encodedId){const id=decodeURIComponent(encodedId),d=donors.find(x=>x.id===id);if(!d)return;if(!confirm(`Delete the donor record for ${d.name}? This cannot be undone unless you have a backup.`))return;const old=donors;donors=donors.filter(x=>x.id!==id);if(!saveData()){donors=old;return;}refreshDashboard();notify('Donor record deleted.');}

function renderCharts(counts){
  if(typeof Chart==='undefined')return;
  const labels=GROUPS,values=GROUPS.map(g=>counts[g]);
  if($('bloodChart')){
    if(bloodChart)bloodChart.destroy();
    bloodChart=new Chart($('bloodChart'),{type:'doughnut',data:{labels,datasets:[{data:values,backgroundColor:COLORS,borderColor:'#fff',borderWidth:4,hoverOffset:7}]},options:{responsive:true,maintainAspectRatio:false,cutout:'73%',plugins:{legend:{display:false},tooltip:{backgroundColor:'#172538',padding:11,displayColors:true}}}});
  }
  if($('analyticsChart')&&$('analytics').classList.contains('active')){
    if(analyticsChart)analyticsChart.destroy();
    analyticsChart=new Chart($('analyticsChart'),{type:'bar',data:{labels,datasets:[{label:'Registered donors',data:values,backgroundColor:COLORS,borderRadius:7,maxBarThickness:42}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{backgroundColor:'#172538',padding:11}},scales:{x:{grid:{display:false},ticks:{color:'#8994a3',font:{size:10}}},y:{beginAtZero:true,ticks:{precision:0,color:'#8994a3',font:{size:9}},grid:{color:'#edf0f3'}}}}});
  }
}
function renderExecutiveSummary(counts){
  const total=donors.length,eligible=donors.filter(getEligibility).length,represented=GROUPS.filter(g=>counts[g]>0).length;
  if(!total){$('executiveSummary').textContent='No donor records are available yet. Register donors to generate a summary of your community.';$('topBloodGroup').textContent='—';$('topBloodDetail').textContent='Register donors to reveal the leading group.';return;}
  const max=Math.max(...GROUPS.map(g=>counts[g]));const leaders=GROUPS.filter(g=>counts[g]===max);
  const avg=(donors.reduce((sum,d)=>sum+Number(d.age),0)/total).toFixed(1);
  $('topBloodGroup').textContent=leaders.join(' / ');$('topBloodDetail').textContent=`${max} registration${max===1?'':'s'}${leaders.length>1?' (joint highest)':''}`;
  $('executiveSummary').textContent=`LifeDrop currently contains ${total} registered donor profile${total===1?'':'s'}. ${eligible} profile${eligible===1?'':'s'} (${Math.round(eligible/total*100)}%) pass the project's preliminary software screening rules. The average recorded age is ${avg} years, and ${represented} of the 8 blood groups are represented. ${leaders.join(' and ')} ${leaders.length===1?'is':'are'} the most represented blood group${leaders.length===1?'':'s'} with ${max} registration${max===1?'':'s'}. These statistics describe the local registration dataset and do not indicate blood stock or medical eligibility.`;
}
function refreshDashboard(){
  const counts=getBloodCounts(),total=donors.length,eligible=donors.filter(getEligibility).length,represented=GROUPS.filter(g=>counts[g]>0).length;
  const average=total?(donors.reduce((s,d)=>s+Number(d.age),0)/total).toFixed(1):'0';
  $('totalDonors').textContent=total;$('eligibleDonors').textContent=eligible;$('bloodGroups').innerHTML=`${represented}<span class="metric-total">/8</span>`;$('averageAge').textContent=average;
  $('analyticsTotal').textContent=total;$('analyticsAge').textContent=average;$('analyticsGroups').textContent=`${represented} / 8`;$('eligibilityRate').textContent=total?`${Math.round(eligible/total*100)}%`:'0%';
  $('insightTotal').textContent=total;$('insightGroups').textContent=`${represented} of 8`;$('insightEligible').textContent=eligible;$('navDonorCount').textContent=total;$('chartTotal').textContent=total;
  renderBloodSummary(counts);renderRecentDonors();renderDonorTable();renderCharts(counts);renderExecutiveSummary(counts);
}

function csvCell(value){let text=String(value??'');if(/^[\s]*[=+\-@]/.test(text))text="'"+text;return '"'+text.replace(/"/g,'""')+'"';}
function downloadFile(content,filename,type){const blob=new Blob([content],{type});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function exportCSV(){if(!donors.length)return notify('There are no donor records to export.');const headers=['Name','Phone','Email','Age','Gender','Blood Group','City','Address','Last Donation','Preliminary Screening','Registration Date'];const rows=donors.map(d=>[d.name,d.phone,d.email,d.age,d.gender,d.bloodGroup,d.city,d.address,d.lastDonation,getEligibility(d)?'Screening passed':'Needs review',d.registeredAt]);const csv=[headers,...rows].map(row=>row.map(csvCell).join(',')).join('\r\n');downloadFile('\uFEFF'+csv,'lifedrop_donors.csv','text/csv;charset=utf-8');notify('CSV file exported successfully.');}
function exportBackup(){const backup={application:'LifeDrop',formatVersion:1,exportedAt:new Date().toISOString(),donors};downloadFile(JSON.stringify(backup,null,2),'lifedrop_backup.json','application/json');notify('Backup downloaded. Keep it in a safe place.');}
function downloadReport(){if(!donors.length)return notify('Register donors before generating a report.');const counts=getBloodCounts(),total=donors.length,eligible=donors.filter(getEligibility).length,avg=(donors.reduce((s,d)=>s+Number(d.age),0)/total).toFixed(1);const report=[
  'LIFEDROP — SMART BLOOD DONOR NETWORK','='.repeat(42),`Generated: ${new Date().toLocaleString()}`,'','EXECUTIVE SUMMARY','-----------------',`Total registered donor profiles: ${total}`,`Preliminary screening passed: ${eligible}`,`Preliminary screening pass rate: ${Math.round(eligible/total*100)}%`,`Average recorded age: ${avg} years`,`Blood groups represented: ${GROUPS.filter(g=>counts[g]>0).length}/8`,'','BLOOD GROUP DISTRIBUTION','------------------------',...GROUPS.map(g=>`${g}: ${counts[g]} donor profile(s)`),'','IMPORTANT LIMITATIONS','---------------------','This report summarizes locally stored donor registration records only.','It does not represent blood inventory, verified donors, or available blood units.','The software screening indicator is not medical clearance. Qualified medical','staff must assess actual donor eligibility. Data is stored in this browser only.'
].join('\n');downloadFile(report,'lifedrop_executive_report.txt','text/plain;charset=utf-8');notify('Executive report downloaded.');}

// Date and first load
$('todayLabel').textContent=new Date().toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short',year:'numeric'});
const initialSection=location.hash.replace('#','');showSection(pageInfo[initialSection]?initialSection:'dashboard');
