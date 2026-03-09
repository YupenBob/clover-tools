#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
WASTE Journal 投稿邮件检查脚本
使用 163 邮箱 POP3 协议接收投稿
"""

import poplib
import email
from email.header import decode_header
import json
import sys
from datetime import datetime

# 配置
POP3_SERVER = "pop.163.com"
POP3_PORT = 995
USERNAME = "york255@163.com"

def decode_mime_words(text):
    """解码 MIME 编码的邮件头"""
    if not text:
        return ""
    decoded = []
    for part, encoding in decode_header(text):
        if isinstance(part, bytes):
            try:
                decoded.append(part.decode(encoding or 'utf-8'))
            except:
                decoded.append(part.decode('latin-1'))
        else:
            decoded.append(part)
    return ''.join(decoded)

def check_mailbox(password, max_emails=10):
    """检查邮箱，返回最新邮件列表"""
    results = {
        "success": False,
        "message": "",
        "emails": [],
        "timestamp": datetime.now().isoformat()
    }
    
    try:
        print(f"连接到 {POP3_SERVER}:{POP3_PORT}...")
        pop3 = poplib.POP3_SSL(POP3_SERVER, POP3_PORT)
        pop3.user(USERNAME)
        pop3.pass_(password)
        
        num_messages = len(pop3.list()[1])
        results["message"] = f"邮箱共有 {num_messages} 封邮件"
        print(f"邮箱共有 {num_messages} 封邮件")
        
        for i in range(max(1, num_messages - max_emails + 1), num_messages + 1):
            raw_email = b"\r\n".join(pop3.retr(i)[1])
            msg = email.message_from_bytes(raw_email)
            
            email_data = {
                "id": i,
                "from": decode_mime_words(msg.get("From", "")),
                "to": decode_mime_words(msg.get("To", "")),
                "subject": decode_mime_words(msg.get("Subject", "")),
                "date": msg.get("Date", ""),
                "body": "",
                "is_submission": "【WASTE 投稿】" in decode_mime_words(msg.get("Subject", ""))
            }
            
            if msg.is_multipart():
                for part in msg.walk():
                    content_type = part.get_content_type()
                    content_disposition = str(part.get("Content-Disposition", ""))
                    if content_type == "text/plain" and "attachment" not in content_disposition:
                        try:
                            email_data["body"] = part.get_payload(decode=True).decode('utf-8', errors='ignore')
                        except:
                            email_data["body"] = part.get_payload(decode=True).decode('latin-1', errors='ignore')
                        break
            else:
                try:
                    email_data["body"] = msg.get_payload(decode=True).decode('utf-8', errors='ignore')
                except:
                    email_data["body"] = msg.get_payload(decode=True).decode('latin-1', errors='ignore')
            
            results["emails"].append(email_data)
            print(f"邮件 #{i}: {email_data['subject'][:50]}... {'[投稿]' if email_data['is_submission'] else ''}")
        
        pop3.quit()
        results["success"] = True
        
    except poplib.error_proto as e:
        results["message"] = f"POP3 错误：{e}"
        print(f"POP3 错误：{e}")
    except Exception as e:
        results["message"] = f"错误：{e}"
        print(f"错误：{e}")
    
    return results

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("用法：python3 check_mail.py <password> [max_emails]")
        sys.exit(1)
    
    password = sys.argv[1]
    max_emails = int(sys.argv[2]) if len(sys.argv) > 2 else 10
    
    results = check_mailbox(password, max_emails)
    print("\n=== JSON 结果 ===")
    print(json.dumps(results, ensure_ascii=False, indent=2))
