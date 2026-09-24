import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import './App.css'

const TIME_SLOTS = ['09:00', '11:00', '13:00', '15:00', '17:00']
const ADMIN_EMAILS = ['n.manbanjong@gmail.com']
const MONTH_NAMES = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
]

const getFormattedDate = (dateObj) => {
  const year = dateObj.getFullYear()
  const month = String(dateObj.getMonth() + 1).padStart(2, '0')
  const day = String(dateObj.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function CustomCalendar({ selectedDate, onSelectDate }) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [currentMonth, setCurrentMonth] = useState(new Date(selectedDate || today))

  const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1)
  const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0)
  
  const startDayOfWeek = startOfMonth.getDay()
  const daysInMonth = endOfMonth.getDate()

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))
  }

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))
  }

  const handleGoToToday = () => {
    const todayObj = new Date()
    setCurrentMonth(todayObj)
    onSelectDate(getFormattedDate(todayObj))
  }

  const calendarDays = []
  for (let i = 0; i < startDayOfWeek; i++) {
    calendarDays.push(null)
  }
  for (let d = 1; d <= daysInMonth; d++) {
    calendarDays.push(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), d))
  }

  return (
    <div className="calendar-box">
      <div className="calendar-header-controls">
        <button type="button" onClick={handlePrevMonth} className="cal-nav-btn">
          ❮ เดือนก่อน
        </button>

        <div className="calendar-title-group">
          <strong className="calendar-month-text">
            {MONTH_NAMES[currentMonth.getMonth()]} {currentMonth.getFullYear() + 543}
          </strong>
          <button type="button" onClick={handleGoToToday} className="cal-today-btn">
            📌 ไปเดือนนี้
          </button>
        </div>

        <button type="button" onClick={handleNextMonth} className="cal-nav-btn">
          เดือนถัดไป ❯
        </button>
      </div>

      <div className="calendar-weekdays">
        <span className="sun">อา</span>
        <span>จ</span>
        <span>อ</span>
        <span>พ</span>
        <span>พฤ</span>
        <span>ศ</span>
        <span className="sat">ส</span>
      </div>

      <div className="calendar-grid">
        {calendarDays.map((date, index) => {
          if (!date) return <div key={`empty-${index}`} />

          const dateStr = getFormattedDate(date)
          const isPast = date < today
          const isSelected = selectedDate === dateStr
          const isToday = getFormattedDate(today) === dateStr

          return (
            <button
              key={dateStr}
              type="button"
              disabled={isPast}
              onClick={() => onSelectDate(dateStr)}
              className={`cal-day-btn ${isSelected ? 'selected' : ''} ${isToday && !isSelected ? 'today' : ''} ${isPast ? 'past' : ''}`}
            >
              {date.getDate()}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function App() {
  const [session, setSession] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [allBookings, setAllBookings] = useState([])
  const [myBookings, setMyBookings] = useState([])
  const [currentView, setCurrentView] = useState('form')

  // Dark Mode State
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark'
  })

  useEffect(() => {
    if (darkMode) {
      document.body.classList.add('dark-mode')
      localStorage.setItem('theme', 'dark')
    } else {
      document.body.classList.remove('dark-mode')
      localStorage.setItem('theme', 'light')
    }
  }, [darkMode])

  const todayStr = getFormattedDate(new Date())
  
  const [formData, setFormData] = useState({
    customer_name: '',
    phone: '',
    address: '',
    service_type: 'ล้างแอร์ติดผนัง',
    quantity: 1,
    booking_date: todayStr,
    booking_time: ''
  })

  const [editingBooking, setEditingBooking] = useState(null)
  const [editFormData, setEditFormData] = useState({
    customer_name: '',
    phone: '',
    address: '',
    service_type: 'ล้างแอร์ติดผนัง',
    quantity: 1,
    booking_date: todayStr,
    booking_time: ''
  })
  const [editBookedSlots, setEditBookedSlots] = useState([])

  const [bookedSlots, setBookedSlots] = useState([])
  const [loading, setLoading] = useState(false)
  const [fetchingSlots, setFetchingSlots] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      handleSessionChange(session)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      handleSessionChange(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleSessionChange = (session) => {
    setSession(session)
    if (session?.user) {
      const userEmail = session.user.email
      if (ADMIN_EMAILS.includes(userEmail)) {
        setIsAdmin(true)
        fetchAllBookings()
      } else {
        setIsAdmin(false)
        if (session.user.user_metadata?.full_name) {
          setFormData(prev => ({ ...prev, customer_name: session.user.user_metadata.full_name }))
        }
        fetchMyBookings(session.user.id)
      }
    } else {
      setIsAdmin(false)
    }
  }

  const fetchAllBookings = async () => {
    setFetchingSlots(true)
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .order('created_at', { ascending: false })

    if (!error) setAllBookings(data || [])
    setFetchingSlots(false)
  }

  const fetchMyBookings = async (userId) => {
    if (!userId) return
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (!error) setMyBookings(data || [])
  }

  const handleUpdateStatus = async (id, newStatus) => {
    const confirmAction = window.confirm(`คุณต้องการเปลี่ยนสถานะรายการนี้เป็น "${newStatus}" ใช่หรือไม่?`)
    if (!confirmAction) return

    const { error } = await supabase.from('bookings').update({ status: newStatus }).eq('id', id)
    if (!error) {
      alert(`อัปเดตสถานะเป็น "${newStatus}" เรียบร้อยแล้ว!`)
      fetchAllBookings()
      fetchBookedSlots(formData.booking_date)
    }
  }

  const handleCancelBooking = async (id) => {
    const confirmCancel = window.confirm('คุณต้องการยกเลิกการจองคิวนี้ใช่หรือไม่?')
    if (!confirmCancel) return

    const { error } = await supabase.from('bookings').update({ status: 'ยกเลิกแล้ว' }).eq('id', id)
    if (!error) {
      alert('ยกเลิกการจองคิวเรียบร้อยแล้ว')
      if (session?.user?.id) fetchMyBookings(session.user.id)
      fetchBookedSlots(formData.booking_date)
    }
  }

  const handleOpenEditModal = (booking) => {
    setEditingBooking(booking)
    setEditFormData({
      customer_name: booking.customer_name,
      phone: booking.phone,
      address: booking.address,
      service_type: booking.service_type,
      quantity: booking.quantity,
      booking_date: booking.booking_date,
      booking_time: booking.booking_time
    })
    fetchEditBookedSlots(booking.booking_date, booking.id)
  }

  const fetchEditBookedSlots = async (date, currentBookingId) => {
    const { data, error } = await supabase
      .from('bookings')
      .select('booking_time, status, id')
      .eq('booking_date', date)
      .neq('status', 'ปฏิเสธ')
      .neq('status', 'ยกเลิกแล้ว')
      .neq('id', currentBookingId)

    if (!error && data) {
      setEditBookedSlots(data.map(item => item.booking_time))
    }
  }

  const handleSaveEdit = async (e) => {
    e.preventDefault()
    if (!editFormData.booking_time) {
      alert('กรุณาเลือกช่วงเวลาที่ต้องการรับบริการ')
      return
    }

    setLoading(true)
    const { error } = await supabase
      .from('bookings')
      .update({ ...editFormData, status: 'รอการยืนยัน' })
      .eq('id', editingBooking.id)

    setLoading(false)

    if (!error) {
      alert('✏️ แก้ไขข้อมูลการจองสำเร็จ! ระบบส่งเรื่องให้แอดมินยืนยันอีกครั้งครับ')
      setEditingBooking(null)
      if (session?.user?.id) fetchMyBookings(session.user.id)
      fetchBookedSlots(formData.booking_date)
    }
  }

  useEffect(() => {
    if (session && !isAdmin) {
      fetchBookedSlots(formData.booking_date)
    }
  }, [formData.booking_date, session, isAdmin])

  const fetchBookedSlots = async (date) => {
    setFetchingSlots(true)
    const { data, error } = await supabase
      .from('bookings')
      .select('booking_time, status')
      .eq('booking_date', date)
      .neq('status', 'ปฏิเสธ')
      .neq('status', 'ยกเลิกแล้ว')

    if (!error) setBookedSlots(data.map(item => item.booking_time))
    setFetchingSlots(false)
  }

  const handleLoginGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    })
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setIsAdmin(false)
  }

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.booking_time) {
      alert('กรุณาเลือกช่วงเวลาที่ต้องการรับบริการ')
      return
    }

    setLoading(true)
    const { error } = await supabase.from('bookings').insert([
      { ...formData, user_id: session?.user?.id, status: 'รอการยืนยัน' }
    ])
    setLoading(false)

    if (!error) {
      alert('🎉 บันทึกการจองสำเร็จ!')
      if (session?.user?.id) await fetchMyBookings(session.user.id)
      fetchBookedSlots(formData.booking_date)
      setCurrentView('status')
      setFormData(prev => ({ ...prev, phone: '', address: '', quantity: 1, booking_time: '' }))
    }
  }

  // Component แถบโปรไฟล์ผู้ใช้งานด้านบน
  const renderProfileHeader = (roleText) => {
    const userMeta = session.user.user_metadata
    const avatarUrl = userMeta?.avatar_url || userMeta?.picture
    const displayName = userMeta?.full_name || session.user.email

    return (
      <div className="profile-header-card">
        <div className="profile-info-left">
          {avatarUrl ? (
            <img src={avatarUrl} alt="Avatar" className="profile-avatar" />
          ) : (
            <div className="profile-avatar-placeholder">👤</div>
          )}
          <div className="profile-text-group">
            <span className="profile-name">{displayName}</span>
            <span className="profile-email">{session.user.email} <span className="role-tag">{roleText}</span></span>
          </div>
        </div>
        <div className="profile-actions-right">
          <button 
            type="button" 
            className="theme-toggle-btn" 
            onClick={() => setDarkMode(!darkMode)}
            title="สลับโหมดมืด/สว่าง"
          >
            {darkMode ? '☀️ สว่าง' : '🌙 มืด'}
          </button>
          <button className="logout-btn" onClick={handleLogout}>ออกจากระบบ</button>
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="booking-card login-card">
        <div className="login-top-bar">
          <button 
            type="button" 
            className="theme-toggle-btn" 
            onClick={() => setDarkMode(!darkMode)}
          >
            {darkMode ? '☀️ โหมดสว่าง' : '🌙 โหมดมืด'}
          </button>
        </div>
        <h2 className="title">🛠️ MBJ Air Service</h2>
        <p className="subtitle">กรุณาเข้าสู่ระบบก่อนทำการจองคิวบริการ</p>
        <div className="login-buttons">
          <button className="social-btn google-btn" onClick={handleLoginGoogle}>
            <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" width="20" />
            เข้าสู่ระบบด้วย Google (Gmail)
          </button>
        </div>
      </div>
    )
  }

  if (isAdmin) {
    return (
      <div className="booking-card admin-card">
        {renderProfileHeader('แอดมิน')}

        <h2 className="title">📋 รายการจองคิวแอร์ทั้งหมด</h2>

        {fetchingSlots ? (
          <p className="loading-text">กำลังโหลดข้อมูลการจอง...</p>
        ) : allBookings.length === 0 ? (
          <p className="subtitle">ยังไม่มีรายการจองคิวในระบบ</p>
        ) : (
          <div className="admin-table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>วันที่</th>
                  <th>เวลา</th>
                  <th>ชื่อผู้ติดต่อ</th>
                  <th>เบอร์โทร</th>
                  <th>บริการ</th>
                  <th>จำนวน</th>
                  <th>ที่อยู่</th>
                  <th>สถานะ</th>
                  <th>จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {allBookings.map((item) => (
                  <tr key={item.id}>
                    <td>#{item.id}</td>
                    <td>{item.booking_date}</td>
                    <td>{item.booking_time} น.</td>
                    <td>{item.customer_name}</td>
                    <td>{item.phone}</td>
                    <td>{item.service_type}</td>
                    <td>{item.quantity}</td>
                    <td>{item.address}</td>
                    <td>
                      <span className={`status-badge ${
                        item.status === 'อนุมัติแล้ว' ? 'approved' : 
                        item.status === 'ปฏิเสธ' || item.status === 'ยกเลิกแล้ว' ? 'rejected' : 'pending'
                      }`}>
                        {item.status || 'รอการยืนยัน'}
                      </span>
                    </td>
                    <td>
                      {(!item.status || item.status === 'รอการยืนยัน') && (
                        <div className="action-buttons">
                          <button className="btn-approve" onClick={() => handleUpdateStatus(item.id, 'อนุมัติแล้ว')}>✅ อนุมัติ</button>
                          <button className="btn-reject" onClick={() => handleUpdateStatus(item.id, 'ปฏิเสธ')}>❌ ปฏิเสธ</button>
                        </div>
                      )}
                      
                      {item.status === 'อนุมัติแล้ว' && (
                        <button className="btn-reject cancel-action" onClick={() => handleUpdateStatus(item.id, 'ยกเลิกแล้ว')}>
                          🗑️ ยกเลิกนัด
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="booking-container">
      <div className="nav-tabs-wrapper">
        <div className="nav-tabs">
          <button className={`tab-btn ${currentView === 'form' ? 'active' : ''}`} onClick={() => setCurrentView('form')}>
            📝 ฟอร์มจองคิว
          </button>
          <button className={`tab-btn ${currentView === 'status' ? 'active' : ''}`} onClick={() => { if (session?.user?.id) fetchMyBookings(session.user.id); setCurrentView('status'); }}>
            📂 สถานะการจอง ({myBookings.length})
          </button>
        </div>
      </div>

      {currentView === 'form' ? (
        <div className="booking-card">
          {renderProfileHeader('ลูกค้า')}

          <h2 className="title">🛠️ จองคิวบริการแอร์ MBJ Air</h2>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>ชื่อผู้ติดต่อ:</label>
              <input type="text" name="customer_name" value={formData.customer_name} onChange={handleChange} required placeholder="กรอกชื่อผู้ติดต่อ" />
            </div>

            <div className="form-group">
              <label>เบอร์โทรศัพท์:</label>
              <input type="tel" name="phone" value={formData.phone} onChange={handleChange} required placeholder="กรุณากรอกเบอร์โทรศัพท์" />
            </div>

            <div className="form-group">
              <label>ที่อยู่จัดส่งช่าง:</label>
              <textarea name="address" value={formData.address} onChange={handleChange} required rows="2" placeholder="บ้านเลขที่, ถนน, ซอย..." />
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label>ประเภทบริการ:</label>
                <select name="service_type" value={formData.service_type} onChange={handleChange}>
                  <option value="ล้างแอร์ติดผนัง">ล้างแอร์ติดผนัง</option>
                  <option value="ล้างแอร์แขวน/สี่ทิศทาง">ล้างแอร์แขวน/สี่ทิศทาง</option>
                  <option value="ซ่อมแอร์/เติมน้ำยา">ซ่อมแอร์/เติมน้ำยา</option>
                  <option value="ติดตั้งแอร์ใหม่">ติดตั้งแอร์ใหม่</option>
                </select>
              </div>

              <div className="form-group">
                <label>จำนวน (เครื่อง):</label>
                <input type="number" name="quantity" min="1" value={formData.quantity} onChange={handleChange} required />
              </div>
            </div>

            <div className="form-group">
              <label>📅 คลิกเลือกวันที่รับบริการจากปฏิทิน:</label>
              <CustomCalendar 
                selectedDate={formData.booking_date}
                onSelectDate={(dateStr) => setFormData({ ...formData, booking_date: dateStr, booking_time: '' })}
              />
              <p className="selected-date-text">
                วันที่เลือก: {formData.booking_date}
              </p>
            </div>

            <div className="form-group">
              <label>⏰ เลือกช่วงเวลาว่าง:</label>
              {fetchingSlots ? (
                <p className="loading-text">กำลังตรวจสอบคิวว่าง...</p>
              ) : (
                <div className="slots-grid">
                  {TIME_SLOTS.map((time) => {
                    const isBooked = bookedSlots.some(slot => slot === time || slot === `${time}:00`)
                    const isSelected = formData.booking_time === time

                    return (
                      <button
                        key={time}
                        type="button"
                        disabled={isBooked}
                        className={`slot-btn ${isBooked ? 'booked' : ''} ${isSelected ? 'selected' : ''}`}
                        onClick={() => setFormData({ ...formData, booking_time: time })}
                      >
                        {time} น.
                        <span className="slot-status">{isBooked ? '❌ เต็ม' : isSelected ? 'เลือกแล้ว' : 'ว่าง'}</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            <button type="submit" className="submit-btn" disabled={loading || !formData.booking_time}>
              {loading ? 'กำลังบันทึก...' : 'ยืนยันการจองคิว'}
            </button>
          </form>
        </div>
      ) : (
        <div className="booking-card">
          {renderProfileHeader('ลูกค้า')}

          <h2 className="title">📄 ตรวจสอบสถานะการจองคิว</h2>
          
          {myBookings.length === 0 ? (
            <div className="empty-status">
              <p className="subtitle">คุณยังไม่มีรายการจองคิวในระบบ</p>
              <button className="submit-btn" onClick={() => setCurrentView('form')}>➕ ไปที่หน้าจองคิว</button>
            </div>
          ) : (
            <div className="status-list">
              {myBookings.map((item) => (
                <div key={item.id} className="status-item-card">
                  <div className="status-header">
                    <span className={`status-badge ${
                      item.status === 'อนุมัติแล้ว' ? 'approved' : 
                      item.status === 'ปฏิเสธ' || item.status === 'ยกเลิกแล้ว' ? 'rejected' : 'pending'
                    }`}>
                      {item.status === 'อนุมัติแล้ว' ? '✅ อนุมัติแล้ว' : 
                       item.status === 'ปฏิเสธ' ? '❌ ถูกปฏิเสธ' : 
                       item.status === 'ยกเลิกแล้ว' ? '🚫 ยกเลิกแล้ว' : '⏳ รอแอดมินยืนยัน'}
                    </span>
                  </div>

                  <div className="status-body">
                    <div className="info-row"><span>📅 นัดวันที่:</span> <strong>{item.booking_date} ({item.booking_time} น.)</strong></div>
                    <div className="info-row"><span>🛠️ บริการ:</span> <strong>{item.service_type} ({item.quantity} เครื่อง)</strong></div>
                    <div className="info-row"><span>👤 ผู้ติดต่อ:</span> <strong>{item.customer_name}</strong></div>
                    <div className="info-row"><span>📞 เบอร์โทรติดต่อ:</span> <strong>{item.phone}</strong></div>
                    <div className="info-row"><span>📍 ที่อยู่:</span> <strong>{item.address}</strong></div>
                  </div>

                  {item.status === 'อนุมัติแล้ว' && (
                    <div className="status-footer success">🎉 คิวของคุณได้รับการยืนยันแล้ว ช่างจะเข้าให้บริการตามวันและเวลาที่นัดหมายครับ</div>
                  )}
                  {item.status === 'ปฏิเสธ' && (
                    <div className="status-footer danger">ขออภัย คิวช่วงเวลานี้เต็มหรือติดภารกิจอื่น กรุณาลองจองวันหรือเวลาใหม่อีกครั้งครับ</div>
                  )}
                  {(!item.status || item.status === 'รอการยืนยัน') && (
                    <div className="status-footer warning">⏳ ทางร้านกำลังตรวจสอบคิวงาน จะทำการอัปเดตสถานะให้เร็วที่สุดครับ</div>
                  )}

                  {item.status !== 'ยกเลิกแล้ว' && item.status !== 'ปฏิเสธ' && (
                    <div className="card-actions">
                      {item.status === 'อนุมัติแล้ว' ? (
                        <div className="approved-notice">
                          📞 หากต้องการยกเลิกหรือเปลี่ยนแปลงนัดหมายที่ยืนยันแล้ว กรุณาโทรติดต่อทางร้านโดยตรงครับ
                        </div>
                      ) : (
                        <div className="action-button-group">
                          <button className="edit-btn" onClick={() => handleOpenEditModal(item)}>✏️ แก้ไขข้อมูล</button>
                          <button className="cancel-btn" onClick={() => handleCancelBooking(item.id)}>🗑️ ยกเลิกนัดนี้</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}

              <button className="add-more-btn" onClick={() => setCurrentView('form')}>➕ ทำรายการจองเพิ่ม</button>
            </div>
          )}
        </div>
      )}

      {editingBooking && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>✏️ แก้ไขข้อมูลการจอง</h3>
            <form onSubmit={handleSaveEdit}>
              <div className="form-group"><label>ชื่อผู้ติดต่อ:</label><input type="text" value={editFormData.customer_name} onChange={(e) => setEditFormData({ ...editFormData, customer_name: e.target.value })} required placeholder="กรอกชื่อผู้ติดต่อ" /></div>
              <div className="form-group"><label>เบอร์โทรศัพท์:</label><input type="tel" value={editFormData.phone} onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })} required placeholder="กรุณากรอกเบอร์โทรศัพท์" /></div>
              <div className="form-group"><label>ที่อยู่จัดส่งช่าง:</label><textarea value={editFormData.address} onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })} required rows="2" /></div>
              <div className="grid-2">
                <div className="form-group">
                  <label>ประเภทบริการ:</label>
                  <select value={editFormData.service_type} onChange={(e) => setEditFormData({ ...editFormData, service_type: e.target.value })}>
                    <option value="ล้างแอร์ติดผนัง">ล้างแอร์ติดผนัง</option>
                    <option value="ล้างแอร์แขวน/สี่ทิศทาง">ล้างแอร์แขวน/สี่ทิศทาง</option>
                    <option value="ซ่อมแอร์/เติมน้ำยา">ซ่อมแอร์/เติมน้ำยา</option>
                    <option value="ติดตั้งแอร์ใหม่">ติดตั้งแอร์ใหม่</option>
                  </select>
                </div>
                <div className="form-group"><label>จำนวน (เครื่อง):</label><input type="number" min="1" value={editFormData.quantity} onChange={(e) => setEditFormData({ ...editFormData, quantity: e.target.value })} required /></div>
              </div>

              <div className="form-group">
                <label>📅 วันที่รับบริการ:</label>
                <CustomCalendar 
                  selectedDate={editFormData.booking_date}
                  onSelectDate={(dateStr) => {
                    setEditFormData({ ...editFormData, booking_date: dateStr, booking_time: '' })
                    fetchEditBookedSlots(dateStr, editingBooking.id)
                  }}
                />
              </div>

              <div className="form-group">
                <label>⏰ ช่วงเวลาว่าง:</label>
                <div className="slots-grid modal-slots-grid">
                  {TIME_SLOTS.map((time) => {
                    const isBooked = editBookedSlots.some(slot => slot === time || slot === `${time}:00`)
                    const isSelected = editFormData.booking_time === time

                    return (
                      <button
                        key={time}
                        type="button"
                        disabled={isBooked}
                        className={`slot-btn ${isBooked ? 'booked' : ''} ${isSelected ? 'selected' : ''}`}
                        onClick={() => setEditFormData({ ...editFormData, booking_time: time })}
                      >
                        {time} น.
                        <span className="slot-status">{isBooked ? '❌ เต็ม' : isSelected ? 'เลือกแล้ว' : 'ว่าง'}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" className="modal-cancel-btn" onClick={() => setEditingBooking(null)}>ยกเลิก</button>
                <button type="submit" className="modal-save-btn" disabled={loading || !editFormData.booking_time}>{loading ? 'กำลังบันทึก...' : '💾 บันทึกการแก้ไข'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default App