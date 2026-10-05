# Quiz & Code — bài kiểm tra tích hợp APU

Mở tab **Quiz & Code** ở thanh điều hướng sau khi đăng nhập.

## Giáo viên

1. Tạo lớp/khóa học, xuất bản lớp và thêm hoặc mời học sinh trong **Courses & students**.
2. Chọn **Quiz & Code → Tạo bài kiểm tra**. Nhập tên đề, lớp, hướng dẫn và hạn nộp nếu cần.
3. Thêm câu trắc nghiệm (chọn đáp án đúng), câu tự luận và bài Python. Có thể đặt điểm từng câu và code khởi đầu.
4. **Lưu nháp & xem lại**. Bản nháp chỉ giáo viên thấy; có thể chọn **Sửa đề** để tiếp tục soạn.
5. **Xem đề** để thử quiz/Python, rồi **Giao cho lớp**. Nội dung và đáp án được khóa sau khi giao; tạo đề mới nếu cần đổi nội dung.
6. Trong **Quản lý & chấm bài**, xem bài nháp, bài đã nộp và danh sách chưa nộp. Chọn học sinh để xem toàn bộ quiz/code, nhập điểm tự luận/Python và nhận xét.
7. Có thể tải toàn bộ bài làm dạng JSON hoặc từng chương trình `.py`. **Đóng bài** ngừng nhận bài; **Mở lại bài** nhận bài tiếp nếu chưa quá hạn.

## Học sinh

1. Vào **Quiz & Code**, chọn bài giáo viên giao.
2. Làm quiz, viết Python và nhấn **Chạy thử**. Dữ liệu cho `input()` nhập mỗi giá trị một dòng.
3. Sau thay đổi, hệ thống giữ nháp trên máy và tự đồng bộ sau khoảng 2 giây. Chỉ trạng thái **Đã lưu trên hệ thống** xác nhận bản nháp đã lưu vào tài khoản. Khi mất mạng, giữ trang/bản nháp trên cùng trình duyệt và thử lưu lại khi có mạng.
4. Hoàn thành tất cả câu hỏi, nhấn **Nộp bài → Xác nhận nộp bài**. Sau thông báo thành công, hệ thống khóa câu trả lời/code và lưu thời gian nộp.
5. Mở lại bài đã nộp để xem điểm trắc nghiệm, điểm giáo viên chấm và nhận xét.

## Cách lưu và chấm

- Mỗi học sinh có một bản nháp/bài nộp cho mỗi đề. Quiz, code, input, stdout/stderr nằm trong cùng bản ghi.
- Khi nộp, máy chủ lưu bản chụp câu hỏi, tự tính điểm trắc nghiệm từ đáp án mà học sinh không được đọc, và tính điểm tối đa cho phần chấm tay.
- Điểm và thời gian do máy chủ xác định. Không dùng điểm do trình duyệt học sinh gửi lên.
- Học sinh chỉ đọc bài của mình. Giáo viên chủ lớp (và quản trị viên) đọc/chấm bài thuộc lớp. Bài nộp không được sửa hoặc đổi chủ.
- Python chạy trong Web Worker để vòng lặp không làm treo giao diện. Giới hạn 30 giây mỗi lần chạy, đầu ra tối đa 50.000 ký tự. Lần chạy đầu cần mạng để tải Pyodide.
- Đây là trình chạy Python cho bài tập console, không phải môi trường notebook Colab đầy đủ. Chấm phần Python hiện là giáo viên chấm; kết quả chạy thử từ trình duyệt không được coi là điểm tự động.

## Đề cũ

Chưa nhập nội dung từ nguồn cũ: mã thư mục Drive được gửi chứa ký tự `ư` nên URL không hợp lệ; Google Form trả về không tìm thấy/không được quyền đọc qua tài khoản Drive kết nối. Cần link thư mục đúng và link làm bài có quyền xem để chuyển chính xác câu hỏi. Nội dung đề không được suy đoán từ tên bài giảng.

## Kiểm tra ngày 05/10/2026

Đã kiểm tra trực tiếp với tài khoản và lớp thử riêng, rồi dọn dữ liệu thử:

- Tạo nháp qua giao diện, lưu đáp án và giao đề.
- Học sinh làm quiz, chạy Python với `input()`, lưu nháp vào Supabase và tải lại trang giữ nguyên bài.
- Nộp thành công, quiz được chấm `2/2`, code/input/đầu ra được lưu, máy chủ từ chối sửa bài đã nộp.
- Giáo viên xem và chấm; học sinh đọc được điểm `10/14` và nhận xét.
- Học sinh không đọc được đáp án, không chấm điểm; tài khoản ngoài lớp không đọc/ghi bài.
- Máy chủ từ chối nộp thiếu câu, điểm giả, điểm chấm quá tối đa, thay đổi nội dung/đáp án đã giao, và lưu sau hạn hoặc khi đóng bài.
- Giao diện trên màn hình rộng 390px không tràn ngang.
- Python xử lý `input()` và lỗi chương trình, không giữ biến giữa hai lần chạy; vòng lặp vô hạn dừng sau 30 giây trong khi trang vẫn phản hồi và lần chạy tiếp theo hoạt động.
- Kiểm tra mã nguồn và build thành công; 9 kiểm thử đơn vị qua.

Các thay đổi được triển khai bằng hai migration mới trong `supabase/migrations`. Migration thứ hai sửa vòng tham chiếu trong quyền đọc lớp/học sinh có từ trước, được phát hiện qua kiểm tra thực tế.
