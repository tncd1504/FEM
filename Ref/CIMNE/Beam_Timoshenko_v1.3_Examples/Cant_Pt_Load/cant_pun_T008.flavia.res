Gid Post Results File 1.0 
### 
# MAT-fem Timoshenko Beam v1.3 
# 
GaussPoints "GPTR" Elemtype Linear 
Number of Gauss Points: 2 
Natural Coordinates: Internal 
end gausspionts 
# 
Result "Displacement" "Load Analysis"  1  Vector OnNodes 
ComponentNames "X-Displ", "Y-Displ", "Z-Displ" 
Values 
     1 0.0 -8.90661e-004 0.0  
     2 0.0 -7.24595e-004 0.0  
     3 0.0 -5.63741e-004 0.0  
     4 0.0 -4.13313e-004 0.0  
     5 0.0 -2.78524e-004 0.0  
     6 0.0 -1.64585e-004 0.0  
     7 0.0 -7.67093e-005 0.0  
     8 0.0 -2.01102e-005 0.0  
     9 0.0         00000 0.0  
End Values 
# 
Result "Rotation" "Load Analysis"  1  Vector OnNodes 
ComponentNames "X-Rot", "Y-Rot", "Z-Rot" 
Values 
     1 0.0 0.0 -1.33445e-004 
     2 0.0 0.0 -1.31360e-004 
     3 0.0 0.0 -1.25105e-004 
     4 0.0 0.0 -1.14680e-004 
     5 0.0 0.0 -1.00084e-004 
     6 0.0 0.0 -8.13183e-005 
     7 0.0 0.0 -5.83823e-005 
     8 0.0 0.0 -3.12763e-005 
     9 0.0 0.0         00000 
End Values 
# 
Result "Reaction Force" "Load Analysis"  1  Vector OnNodes 
ComponentNames "X-Force", "Y-Force", "Z-Force" 
Values 
     1 0.0         00000 0.0  
     2 0.0         00000 0.0  
     3 0.0         00000 0.0  
     4 0.0         00000 0.0  
     5 0.0         00000 0.0  
     6 0.0         00000 0.0  
     7 0.0         00000 0.0  
     8 0.0         00000 0.0  
     9 0.0         00005 0.0  
End Values 
# 
Result "Reaction Moment" "Load Analysis"  1  Vector OnNodes 
ComponentNames "X-Moment", "Y-Moment", "Z-Moment" 
Values 
     1 0.0 0.0         00000 
     2 0.0 0.0         00000 
     3 0.0 0.0         00000 
     4 0.0 0.0         00000 
     5 0.0 0.0         00000 
     6 0.0 0.0         00000 
     7 0.0 0.0         00000 
     8 0.0 0.0         00000 
     9 0.0 0.0  5.00000e+001 
End Values 
# 
Result "Moment and Shear" "Load Analysis"  1  Vector OnNodes 
ComponentNames "Mz", "Qy", "Zero" 
Values 
     1 -7.11709e-001  -5.00000e+000  0.0 
     2 -1.42342e+000  -5.00000e+000  0.0 
     3 -2.84683e+000  -5.00000e+000  0.0 
     4 -4.27025e+000  -5.00000e+000  0.0 
     5 -5.69367e+000  -5.00000e+000  0.0 
     6 -7.11709e+000  -5.00000e+000  0.0 
     7 -8.54050e+000  -5.00000e+000  0.0 
     8 -9.96392e+000  -5.00000e+000  0.0 
     9 -1.06756e+001  -5.00000e+000  0.0 
End Values 
