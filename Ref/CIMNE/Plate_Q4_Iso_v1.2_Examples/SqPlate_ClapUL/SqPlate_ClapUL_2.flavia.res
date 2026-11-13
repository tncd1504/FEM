Gid Post Results File 1.0 
### 
# MAT-fem Plate Q4 Isoparametric v1.2 
# 
Result "Displacements" "Load Analysis"  1  Vector OnNodes 
ComponentNames "X-Displ", "Y-Displ", "Z-Displ" 
Values 
     1 0.0 0.0         00000  
     2 0.0 0.0         00000  
     3 0.0 0.0         00000  
     4 0.0 0.0 -3.57143e+000  
     5 0.0 0.0         00000  
     6 0.0 0.0         00000  
     7 0.0 0.0         00000  
     8 0.0 0.0         00000  
     9 0.0 0.0         00000  
End Values 
# 
Result "Rotation" "Load Analysis"  1  Vector OnNodes 
ComponentNames "X-Rot", "Y-Rot", "Z-Rot" 
Values 
     1         00000         00000 0.0  
     2         00000         00000 0.0  
     3         00000         00000 0.0  
     4         00000         00000 0.0  
     5         00000         00000 0.0  
     6         00000         00000 0.0  
     7         00000         00000 0.0  
     8         00000         00000 0.0  
     9         00000         00000 0.0  
End Values 
# 
Result "Reaction" "Load Analysis"  1  Vector OnNodes 
ComponentNames "Z-Force", "X-Moment", "Y-Moment" 
Values 
     1  6.25000e+000  3.90625e+000 -3.90625e+000  
     2  6.25000e+000         00000 -7.81250e+000  
     3  6.25000e+000  7.81250e+000         00000  
     4         00000         00000         00000  
     5  6.25000e+000  3.90625e+000  3.90625e+000  
     6  6.25000e+000 -3.90625e+000 -3.90625e+000  
     7  6.25000e+000         00000  7.81250e+000  
     8  6.25000e+000 -7.81250e+000         00000  
     9  6.25000e+000 -3.90625e+000  3.90625e+000  
End Values 
# 
Result "Moment" "Load Analysis"  1  Vector OnNodes 
ComponentNames "Mx", "My", "Mxy" 
Values 
     1         00000          00000          00000 
     2         00000          00000          00000 
     3         00000          00000          00000 
     4         00000          00000          00000 
     5         00000          00000          00000 
     6         00000          00000          00000 
     7         00000          00000          00000 
     8         00000          00000          00000 
     9         00000          00000          00000 
End Values 
Result "Shear" "Load Analysis"  1  Vector OnNodes 
ComponentNames "Qx", "Qy", "Zeros" 
Values 
     1  1.25000e+000  -1.25000e+000  0.0 
     2         00000  -1.25000e+000  0.0 
     3  1.25000e+000   1.11022e-016  0.0 
     4  5.55112e-017   1.11022e-016  0.0 
     5  1.25000e+000   1.25000e+000  0.0 
     6 -1.25000e+000  -1.25000e+000  0.0 
     7         00000   1.25000e+000  0.0 
     8 -1.25000e+000   1.11022e-016  0.0 
     9 -1.25000e+000   1.25000e+000  0.0 
End Values 
