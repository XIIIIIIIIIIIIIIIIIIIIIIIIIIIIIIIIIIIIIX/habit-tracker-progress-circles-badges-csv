    // --- App State ---
    let habits = [];
    let history = {}; // {date: {habitId: count,...}}
    let badges = [];
    const STORAGE_KEY = 'habitsTracker-Soft2024';

    // --- DOM Elements ---
    const addHabitForm = document.getElementById('addHabitForm');
    const habitInput = document.getElementById('habitInput');
    const habitTargetInput = document.getElementById('habitTarget');
    const habitsList = document.getElementById('habitsList');
    const badgesList = document.getElementById('badgesList');
    const badgesSection = document.getElementById('badgesSection');
    const historyTable = document.getElementById('historyTable');
    const exportCSVBtn = document.getElementById('exportCSVBtn');
    const resetAllBtn = document.getElementById('resetAllBtn');
    const habitCardTemplate = document.getElementById('habitCardTemplate');

    // --- Utils ---
    function saveState() {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        habits,
        history,
        badges
      }));
    }
    function loadState() {
      const raw = localStorage.getItem(STORAGE_KEY);
      if(raw) {
        try {
          const d = JSON.parse(raw);
          habits = d.habits || [];
          history = d.history || {};
          badges = d.badges || [];
        } catch(e){}
      }
    }
    function uuid() {
      return Date.now().toString(36)+'-'+(Math.random()*1e8|0).toString(36);
    }
    function todayString() {
      return (new Date()).toISOString().slice(0,10);
    }
    function getLastNDates(num) {
      let dates = [];
      const now = new Date();
      for(let i=0;i<num;i++) {
        const d = new Date(now); d.setDate(now.getDate()-i);
        dates.push(d.toISOString().slice(0,10));
      }
      return dates.reverse();
    }
    function getHabitById(id) {
      return habits.find(h=>h.id===id);
    }
    // --- Core Logic ---
    function renderHabits() {
      habitsList.innerHTML = '';
      if(!habits.length) {
        const el = document.createElement('div');
        el.textContent = "Aucune habitude. Ajoutez-en une ci-dessus !";
        el.style.cssText = "color:#adc3cd;font-size:1.09rem;text-align:center;width:100%;";
        habitsList.appendChild(el);
        return;
      }
      habits.forEach(habit => {
        const tpl = habitCardTemplate.content.cloneNode(true);
        const card = tpl.querySelector('.habit-card');
        const title = card.querySelector('.habit-title');
        const count = card.querySelector('.count');
        const plusBtn = card.querySelector('.plus');
        const minusBtn = card.querySelector('.minus');
        const removeBtn = card.querySelector('.remove-btn');
        title.textContent = habit.name;
        count.textContent = `${habit.streak} / ${habit.target}`;
        // Progress circle
        const progressBar = card.querySelector('.progress-bar');
        const radius = 40, circumference = 2 * Math.PI * radius;
        progressBar.setAttribute('r', radius);
        progressBar.setAttribute('cx', 46);
        progressBar.setAttribute('cy', 46);
        progressBar.setAttribute('stroke-width', "10");
        const percent = Math.min(habit.streak/habit.target, 1);
        progressBar.setAttribute('stroke-dasharray', `${(percent*circumference).toFixed(2)} ${circumference}`);
        // Animate circle color (full = gold)
        progressBar.style.stroke = percent>=1 ? '#ffe16a': "var(--accent)";

        // Card soft highlight on full streak
        if(percent>=1) { card.style.background='#f9fbf3'; }
        else { card.style.background='var(--progress-bg)'; }

        // Plus/minus
        plusBtn.addEventListener('click', ()=> { updateHabitStreak(habit.id, 1); });
        minusBtn.addEventListener('click', ()=> { updateHabitStreak(habit.id, -1); });

        // Remove
        removeBtn.addEventListener('click', ()=> {
          if(confirm(`Supprimer "${habit.name}" ?`)) removeHabit(habit.id);
        });

        habitsList.appendChild(card);
      });
    }
    function renderBadges() {
      badgesList.innerHTML = '';
      if(!badges.length) {
        badgesSection.style.display = 'none';
        return;
      }
      badgesSection.style.display = '';
      badges.forEach(b => {
        const badge = document.createElement('div');
        badge.className = 'badge';
        badge.innerHTML = `${b.emoji} ${b.title}`;
        badgesList.appendChild(badge);
      });
    }
    function renderHistory() {
      historyTable.innerHTML = '';
      if(!habits.length) return;
      const dates = getLastNDates(30);
      // Table header
      let thr = '<tr><th>Date</th>';
      habits.forEach(h=>{ thr += `<th>${h.name}</th>`; });
      thr += '</tr>';
      historyTable.insertAdjacentHTML('beforeend', thr);
      // Table rows
      dates.forEach(date => {
        let row = `<tr><td>${date}</td>`;
        habits.forEach(habit => {
          let val = (history[date] && history[date][habit.id]) ? history[date][habit.id] : 0;
          row += `<td>${val}</td>`;
        });
        row += '</tr>';
        historyTable.insertAdjacentHTML('beforeend', row);
      });
    }
    function renderAll() {
      renderHabits();
      renderBadges();
      renderHistory();
    }

    // --- Habit Actions ---
    function addHabit(name,targetDays=7) {
      habits.push({
        id: uuid(),
        name: name,
        streak: 0,
        target: Math.max(1, targetDays|0)
      });
      saveState();
      renderAll();
    }
    function removeHabit(id) {
      habits = habits.filter(h=>h.id!==id);
      // Also remove from history
      for(const d in history) {
        if(history[d][id]!==undefined)
          delete history[d][id];
      }
      saveState();
      renderAll();
    }
    function updateHabitStreak(id, delta) {
      const habit = getHabitById(id);
      if(!habit) return;
      habit.streak = Math.max(0, habit.streak + delta);
      // Save today value in history
      const date = todayString();
      if(!history[date]) history[date] = {};
      history[date][id] = habit.streak;
      // Badges
      checkForBadges(habit);
      saveState();
      renderAll();
    }

    // --- Badges System ---
    // Each unlocked badge = {emoji,title}
    function checkForBadges(habit) {
      // Ex: streak = 7, 21, 50, 100, target atteint
      const existing = new Set(badges.map(b=>b.id));
      // Streak badges
      const streaks = [
        {days:7, emoji:"🥉", title:`${habit.name}: 7 jours de suite`, id:habit.id+"-7"},
        {days:21,emoji:"🥈", title:`${habit.name}: 21 jours 💪`, id:habit.id+"-21"},
        {days:50,emoji:"🥇", title:`${habit.name}: 50 jours !`, id:habit.id+"-50"},
        {days:100,emoji:"🏆", title:`${habit.name}: 100 jours 🎉`, id:habit.id+"-100"},
      ];
      streaks.forEach(st => {
        if(habit.streak >= st.days && !existing.has(st.id)) {
          badges.push({emoji:st.emoji,title:st.title,id:st.id});
          // animation will pop in thanks to animation in CSS
        }
      });
      // Objectif atteint
      if(habit.streak >= habit.target && !existing.has(habit.id+'-target')) {
        badges.push({
          emoji:'✨',
          title:`${habit.name}: Objectif atteint (${habit.target}) !`,
          id:habit.id+'-target'
        });
      }
      // Only keep 18 badges max
      if(badges.length>18)
        badges = badges.slice(-18);
    }

    // --- Event Listeners ---
    addHabitForm.addEventListener('submit', e=>{
      e.preventDefault();
      const name = habitInput.value.trim();
      let target = parseInt(habitTargetInput.value, 10) || 7;
      if(!name) return;
      if(name.length>28) return;
      addHabit(name, target);
      habitInput.value = '';
    });

    exportCSVBtn.addEventListener('click', ()=>{
      const dates = getLastNDates(30);
      let header = ['Date', ...habits.map(h=>h.name)];
      let rows = [header];
      dates.forEach(date => {
        let row = [date];
        habits.forEach(h=>{
          row.push( (history[date] && history[date][h.id]) ? history[date][h.id] : 0 );
        });
        rows.push(row);
      });
      // Generate CSV
      let csv = '';
      rows.forEach(r=>{
        csv += r.map(cell=>{
          let c = String(cell);
          if(/[";\n,]/.test(c)) // escape
            c='"'+c.replace(/"/g,'""')+'"';
          return c;
        }).join(';')+'\n';
      });
      // Download
      const blob = new Blob([csv], {type:'text/csv'});
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `habits_historique_${todayString()}.csv`;
      document.body.appendChild(a); a.click();
      setTimeout(()=>{ document.body.removeChild(a); }, 50);
    });

    resetAllBtn.addEventListener('click', ()=>{
      if(confirm('Effacer toutes les données ?')) {
        habits = [];
        history = {};
        badges = [];
        saveState();
        renderAll();
      }
    });

    // -- Initial load --
    window.addEventListener('DOMContentLoaded', ()=>{
      loadState();
      renderAll();
    });

    // -- Auto-history logging --
    // Each time app opens / day changes,
    function ensureHistoryTracked() {
      const today = todayString();
      if(!history[today]) history[today]={};
      habits.forEach(h=> {
        if(history[today][h.id]===undefined)
          history[today][h.id]=h.streak;
      });
      saveState();
    }
    ensureHistoryTracked();

    // Save history also every 5min to avoid loss
    setInterval(ensureHistoryTracked, 300000);

    // -- Animations on render --
    // (Handled by CSS, new badge appear with "popIn", habit-card with "fadeUp" when mounted.)